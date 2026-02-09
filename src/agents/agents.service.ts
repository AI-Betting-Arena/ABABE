// src/agents/agents.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DateProvider } from '../common/providers/date.provider';
import { MatchStatus } from '../common/constants/match-status.enum';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateProvider: DateProvider,
  ) {}

  async processBet(data: {
    agentId: string;
    secretKey: string;
    matchId: number;
    prediction: string;
    betAmount: number;
    confidence: number; // 추가
    reason: string;
    keyPoints: string[]; // 추가
    analysisStats?: any; // 추가 (JsonB)
  }) {
    // 💡 Prisma 트랜잭션 시작
    return await this.prisma.$transaction(async (tx) => {
      // 1. 에이전트 존재 여부 및 비밀키 확인
      const agent = await tx.agent.findUnique({
        where: { agentId: data.agentId },
      });

      if (!agent) {
        throw new UnauthorizedException('Agent not found.');
      }

      if (agent.secretKey !== data.secretKey) {
        throw new UnauthorizedException('Invalid secret key.');
      }

      // 2. 경기 정보 조회 및 베팅 가능 여부 확인
      const match = await tx.match.findUnique({
        where: { id: data.matchId },
      });

      if (!match) {
        throw new NotFoundException(`Match with ID ${data.matchId} not found.`);
      }

      // 2-1. 1차: DB에 저장된 상태 값으로 베팅 불가 여부 확인
      if (
        match.status === MatchStatus.UPCOMING ||
        match.status === MatchStatus.BETTING_CLOSED ||
        match.status === MatchStatus.SETTLED
      ) {
        throw new BadRequestException(
          `Betting for this match is not allowed. Status: ${match.status}`,
        );
      }

      // 2-2. 2차: 시간 계산으로 마감 여부 확인 (BETTING_OPEN 상태일 때만 의미 있음)
      const now = this.dateProvider.now();
      const tenMinutesInMillis = 10 * 60 * 1000;
      const bettingDeadline = new Date(
        match.utcDate.getTime() - tenMinutesInMillis,
      );

      if (now >= bettingDeadline) {
        // Lazy Update: 마감 시간이 지났다면, 상태를 BETTING_CLOSED로 변경하고 예외 발생
        await tx.match.update({
          where: { id: data.matchId },
          data: { status: MatchStatus.BETTING_CLOSED },
        });
        throw new BadRequestException(
          'Betting deadline has passed for this match.',
        );
      }

      // 3. 잔액 및 베팅량 조건 확인 (Decimal 계산 주의)
      // SOLID 원칙: 단일 책임 원칙 (SRP)을 준수하기 위해 베팅 규칙 검증 로직을 추가
      // KISS 원칙: 복잡하지 않게 직관적인 조건문으로 로직 구현
      const currentBalance = Number(agent.balance);
      const betAmount = data.betAmount;

      // 최소 베팅 금액 확인
      if (betAmount < 100) {
        throw new BadRequestException('Minimum bet amount is 100 points.');
      }

      // 최대 베팅 금액 (20%) 확인
      const maxBetAmount = currentBalance * 0.2;
      if (betAmount > maxBetAmount) {
        throw new BadRequestException(
          `Cannot bet more than 20% of your total points (${maxBetAmount} points).`,
        );
      }

      // 보유 잔액 확인
      if (currentBalance < betAmount) {
        throw new BadRequestException('Insufficient balance.');
      }

      // 4. 에이전트 잔액 차감
      const updatedAgent = await tx.agent.update({
        where: { id: agent.id },
        data: {
          balance: {
            decrement: data.betAmount,
          },
        },
      });

      // 5. Prediction (베팅 기록) 생성
      // keyPoints는 우선 비워두거나 간단히 요약해서 저장
      const prediction = await tx.prediction.create({
        data: {
          agentId: agent.id,
          matchId: data.matchId,
          prediction: data.prediction,
          betAmount: data.betAmount,
          confidence: data.confidence, // 🎯 추가
          summary: data.reason.substring(0, 100),
          content: data.reason,
          keyPoints: data.keyPoints, // 🎯 추가 (String[])
          analysisStats: data.analysisStats || {}, // 🎯 추가 (JsonB)
          status: 'PENDING',
        },
      });

      // 6. 결과 반환 (McpService로 보낼 데이터)
      return {
        agentName: updatedAgent.name,
        remainingBalance: updatedAgent.balance,
        predictionId: prediction.id,
      };
    });
  }

  // AI 에이전트의 잔액을 조회하는 함수
  async getAgentBalance(agentId: string, secretKey: string): Promise<number> {
    const agent = await this.prisma.agent.findUnique({
      where: { agentId },
    });

    if (!agent) {
      throw new UnauthorizedException('Agent not found.');
    }

    if (agent.secretKey !== secretKey) {
      throw new UnauthorizedException('Invalid secret key.');
    }

    return Number(agent.balance);
  }
}
