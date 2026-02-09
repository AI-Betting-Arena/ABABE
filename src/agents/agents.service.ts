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
import { MatchesService } from '../matches/matches.service'; // Import MatchesService
import { AgentBetPredictionType, ProcessBetRequestDto } from './dto/request/process-bet-request.dto'; // Import DTOs
import { ProcessBetResponseDto } from './dto/response/process-bet-response.dto'; // Import ProcessBetResponseDto
import { Prisma } from '@prisma/client'; // Import Prisma for Decimal

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dateProvider: DateProvider,
    private readonly matchesService: MatchesService, // Inject MatchesService
  ) {}

  async processBet(data: ProcessBetRequestDto): Promise<ProcessBetResponseDto> {
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
      const betAmountDecimal = new Prisma.Decimal(data.betAmount);
      const currentBalanceDecimal = agent.balance;

      // 최소 베팅 금액 확인
      const MIN_BET_AMOUNT_RULE = new Prisma.Decimal(100);
      if (betAmountDecimal.lessThan(MIN_BET_AMOUNT_RULE)) {
        throw new BadRequestException(`Minimum bet amount is ${MIN_BET_AMOUNT_RULE.toNumber()} points.`);
      }

      // 최대 베팅 금액 (20%) 확인
      const MAX_BET_PERCENTAGE = new Prisma.Decimal(0.2);
      const maxBetAmount = currentBalanceDecimal.times(MAX_BET_PERCENTAGE);
      if (betAmountDecimal.greaterThan(maxBetAmount)) {
        throw new BadRequestException(
          `Cannot bet more than 20% of your total points (${maxBetAmount.toFixed(2)} points).`,
        );
      }

      // 보유 잔액 확인
      if (currentBalanceDecimal.lessThan(betAmountDecimal)) {
        throw new BadRequestException('Insufficient balance.');
      }

      // 4. 에이전트 잔액 차감
      const updatedAgent = await tx.agent.update({
        where: { id: agent.id },
        data: {
          balance: {
            decrement: betAmountDecimal,
          },
        },
      });

      // 5. Match 풀 업데이트 및 배당률 계산
      const { oddsHome, oddsDraw, oddsAway } = await this.matchesService.calculateAndSetOdds(
        data.matchId,
        betAmountDecimal,
        data.prediction,
      );

      // 6. 베팅 시점의 배당률 결정
      let betOdd: Prisma.Decimal;
      switch (data.prediction) {
        case AgentBetPredictionType.HOME_TEAM:
          betOdd = oddsHome;
          break;
        case AgentBetPredictionType.DRAW:
          betOdd = oddsDraw;
          break;
        case AgentBetPredictionType.AWAY_TEAM:
          betOdd = oddsAway;
          break;
        default:
          throw new Error('Invalid prediction type for odds calculation'); // Should not happen due to DTO validation
      }

      // 7. Prediction (베팅 기록) 생성
      const createdPrediction = await tx.prediction.create({
        data: {
          agentId: agent.id,
          matchId: data.matchId,
          prediction: data.prediction,
          betAmount: betAmountDecimal,
          confidence: data.confidence,
          summary: data.summary,
          content: data.content || '',
          keyPoints: data.keyPoints,
          analysisStats: data.analysisStats || {},
          betOdd: betOdd, // Store the odds at the time of placing the bet
          status: 'PENDING',
        },
      });

      // 8. 결과 반환 (McpService로 보낼 데이터)
      return {
        agentName: updatedAgent.name,
        remainingBalance: updatedAgent.balance.toNumber(),
        betAmount: betAmountDecimal.toNumber(),
        betOdd: betOdd.toNumber(),
        predictionType: data.prediction,
        matchId: data.matchId,
        predictionId: createdPrediction.id,
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
