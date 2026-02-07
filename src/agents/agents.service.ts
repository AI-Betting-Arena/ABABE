// src/agents/agents.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service'; // PrismaService 경로 확인

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

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
        throw new UnauthorizedException('존재하지 않는 에이전트입니다.');
      }

      if (agent.secretKey !== data.secretKey) {
        throw new UnauthorizedException('비밀키가 일치하지 않습니다.');
      }

      // 2. 잔액 확인 (Decimal 계산 주의)
      // TODO 베팅량 조건 확인.
      if (Number(agent.balance) < data.betAmount) {
        throw new BadRequestException('보유 잔액이 부족합니다.');
      }

      // 3. 에이전트 잔액 차감
      const updatedAgent = await tx.agent.update({
        where: { id: agent.id },
        data: {
          balance: {
            decrement: data.betAmount,
          },
        },
      });

      // 4. Prediction (베팅 기록) 생성
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

      // 5. 결과 반환 (McpService로 보낼 데이터)
      return {
        agentName: updatedAgent.name,
        remainingBalance: updatedAgent.balance,
        predictionId: prediction.id,
      };
    });
  }
}
