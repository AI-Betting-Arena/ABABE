import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Match, Prisma } from '../generated/prisma/client';
import { MatchStatus } from '../common/constants/match-status.enum';
import { firstValueFrom } from 'rxjs';

// --- Principle: YAGNI (You Aren't Gonna Need It) ---
// 외부 라이브러리(date-fns) 대신 표준 Date 객체로 로직을 구현하여 불필요한 의존성을 제거.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Interface for the external API match response
interface ExternalMatchApiResponse {
  id: number;
  utcDate: string;
  status:
    | 'SCHEDULED'
    | 'LIVE'
    | 'IN_PLAY'
    | 'PAUSED'
    | 'FINISHED'
    | 'POSTPONED'
    | 'SUSPENDED'
    | 'CANCELLED';
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    duration: string;
    fullTime: {
      home: number;
      away: number;
    };
    halfTime: {
      home: number;
      away: number;
    };
  };
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  // ... other fields from the API response that are not directly used but can be included for completeness
}

// Agent의 통계 변화를 추적하기 위한 인터페이스
interface AgentStatsChange {
  agentId: number;
  isWin: boolean;
  betAmount: Prisma.Decimal;
  winnings: Prisma.Decimal; // 이긴 경우 획득 금액, 진 경우 0
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private readonly API_TOKEN: string;
  private readonly API_BASE_URL = 'https://api.football-data.org/v4';
  private readonly API_DELAY_MS = 6000; // 10 requests per minute

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.API_TOKEN = this.configService.get<string>('FOOTBALL_DATA_API_TOKEN')!; // Added non-null assertion
    if (!this.API_TOKEN) {
      throw new Error(
        'FOOTBALL_DATA_API_TOKEN is not defined in the .env file.',
      );
    }
  }

  @Cron('0 4 * * 1', { timeZone: 'UTC' })
  async handleWeeklySettlement() {
    this.logger.log('Weekly settlement process started.');
    // 각 agentId별로 이번 주 정산된 Prediction들의 통계 변화를 누적
    const weeklyAgentStatsAccumulator = new Map<
      number,
      {
        totalBets: number;
        wonBets: number;
        totalBetAmount: Prisma.Decimal;
        totalWinnings: Prisma.Decimal;
      }
    >();

    try {
      // 1. Calculate previous week's date range (Mon 00:00 UTC to Sun 23:59 UTC)
      const today = new Date();
      const dayOfWeek = today.getUTCDay(); // 0 (Sun) to 6 (Sat)

      const lastSunday = new Date(today);
      lastSunday.setUTCDate(today.getUTCDate() - dayOfWeek);
      lastSunday.setUTCHours(23, 59, 59, 999);

      const lastMonday = new Date(lastSunday);
      lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);
      lastMonday.setUTCHours(0, 0, 0, 0);

      this.logger.log(
        `Processing matches from ${lastMonday.toISOString()} to ${lastSunday.toISOString()}`,
      );

      // 2. Fetch matches to be settled
      const matchesToSettle = await this.prisma.match.findMany({
        where: {
          utcDate: {
            gte: lastMonday,
            lte: lastSunday,
          },
          // API 응답이 FINISHED인 경우에만 정산 대상으로 삼음
          // Prisma 스키마에 FINISHED가 없어 MatchStatus.SETTLED로 필터링하지 않음
          // status: MatchStatus.FINISHED
          // 위와 같이 FINISHED가 있다면 추가해주면 좋음.
        },
      });

      if (matchesToSettle.length === 0) {
        this.logger.log('No matches to settle this week.');
        return;
      }

      this.logger.log(`Found ${matchesToSettle.length} matches to settle.`);

      // 3. Settle each match with a delay
      for (const match of matchesToSettle) {
        try {
          // settleMatch가 이번 매치에서 발생한 AgentStatsChange 목록을 반환
          const matchStatsChanges: AgentStatsChange[] =
            await this.settleMatch(match);
          matchStatsChanges.forEach((change) => {
            const currentStats = weeklyAgentStatsAccumulator.get(
              change.agentId,
            ) || {
              totalBets: 0,
              wonBets: 0,
              totalBetAmount: new Prisma.Decimal(0),
              totalWinnings: new Prisma.Decimal(0),
            };

            currentStats.totalBets += 1; // 총 베팅 횟수 증가
            currentStats.totalBetAmount = currentStats.totalBetAmount.plus(
              change.betAmount,
            ); // 총 베팅 금액 증가

            if (change.isWin) {
              currentStats.wonBets += 1; // 승리 횟수 증가
              currentStats.totalWinnings = currentStats.totalWinnings.plus(
                change.winnings,
              ); // 총 획득 금액 증가
            }
            weeklyAgentStatsAccumulator.set(change.agentId, currentStats);
          });
          this.logger.log(
            `Successfully settled match ID: ${match.id} (API ID: ${match.apiId})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to settle match ID: ${match.id} (API ID: ${match.apiId}). Error: ${error.message}`,
          );
          // Continue to the next match
        }
        await delay(this.API_DELAY_MS);
      }

      // --- Agent 통계 업데이트 ---
      if (weeklyAgentStatsAccumulator.size > 0) {
        this.logger.log(
          `Updating stats for ${weeklyAgentStatsAccumulator.size} agents.`,
        );
        for (const [
          agentId,
          changes,
        ] of weeklyAgentStatsAccumulator.entries()) {
          // Principle: SRP (Single Responsibility Principle)
          // Agent별 통계 업데이트는 별도 메서드에서 처리하며, 이번 주 변경 사항을 전달
          await this.updateAgentStats(agentId, changes);
        }
        this.logger.log('Agent stats updated successfully.');
      } else {
        this.logger.log(
          "No agents affected by this week's settlement. Skipping stats update.",
        );
      }
    } catch (error) {
      this.logger.error(
        `An unexpected error occurred during the weekly settlement process: ${error.message}`,
        error.stack,
      );
    } finally {
      this.logger.log('Weekly settlement process finished.');
    }
  }

  /**
   * --- Principle: SRP (Single Responsibility Principle) & Transactional Integrity ---
   * 단일 경기의 정산 로직을 책임지며, 모든 DB 변경은 트랜잭션으로 처리.
   * 반환값을 AgentStatsChange[]로 변경하여 영향을 받은 prediction들의 통계 변화 목록을 반환
   */
  private async settleMatch(match: Match): Promise<AgentStatsChange[]> {
    const { id: matchId, apiId } = match;
    const matchStatsChanges: AgentStatsChange[] = [];

    // Fetch match result from external API
    const apiMatch = await this.fetchMatchFromApi(apiId);

    if (apiMatch.status !== 'FINISHED' || !apiMatch.score?.winner) {
      // If match is not finished, skip it for now. It will be picked up in the next run.
      this.logger.warn(`Match ${apiId} is not finished yet. Skipping.`);
      return []; // 빈 배열 반환
    }

    const actualWinner = apiMatch.score.winner; // 'HOME_TEAM', 'AWAY_TEAM', 'DRAW'

    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch all pending predictions for this match
      const predictions = await tx.prediction.findMany({
        where: { matchId: matchId, status: 'PENDING' },
        select: {
          id: true,
          agentId: true,
          prediction: true,
          betAmount: true,
          betOdd: true,
        }, // 필요한 필드만 select
      });

      if (predictions.length === 0) {
        this.logger.log(`No pending predictions for match ${matchId}.`);
      }

      for (const prediction of predictions) {
        const isWin = prediction.prediction === actualWinner;
        const newStatus = isWin ? 'SUCCESS' : 'FAIL';
        // 이긴 경우에만 획득 금액이 발생
        const winnings = isWin
          ? new Prisma.Decimal(prediction.betAmount.toString()).times(
              new Prisma.Decimal(prediction.betOdd.toString()),
            )
          : new Prisma.Decimal(0);

        // 2. Update prediction status
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { status: newStatus },
        });

        // 3. If win, update agent's balance
        if (isWin) {
          await tx.agent.update({
            where: { id: prediction.agentId },
            data: {
              balance: {
                increment: winnings,
              },
            },
          });
        }

        // 이번 매치에서 정산된 Prediction의 통계 변화를 수집
        matchStatsChanges.push({
          agentId: prediction.agentId,
          isWin: isWin,
          betAmount: prediction.betAmount,
          winnings: winnings,
        });
      }

      // 4. Update match status to SETTLED
      // Note: We need to find the correct enum value for SETTLED from prisma schema.
      // Based on the schema, it's `MatchStatus.SETTLED`
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.SETTLED },
      });
    });
    return matchStatsChanges; // 정산 완료 후 수집된 통계 변화 목록 반환
  }

  /**
   * --- Principle: SRP (Single Responsibility Principle) & DRY (Don't Repeat Yourself) ---
   * Agent의 통계 카운터들을 업데이트하고, 이를 기반으로 승률 및 ROI를 계산.
   * 모든 필요한 통계 정보는 인자로 받아 재조회 오버헤드를 줄임.
   * --- Principle: KISS (Keep It Simple, Stupid) ---
   * 계산 로직을 명확하고 이해하기 쉽게 구현.
   */
  private async updateAgentStats(
    agentId: number,
    changes: {
      totalBets: number;
      wonBets: number;
      totalBetAmount: Prisma.Decimal;
      totalWinnings: Prisma.Decimal;
    },
  ): Promise<void> {
    // Agent의 현재 통계 값을 조회
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        totalBets: true,
        wonBets: true,
        totalBetAmount: true,
        totalWinnings: true,
      },
    });

    if (!agent) {
      this.logger.warn(
        `Agent with ID ${agentId} not found during stats update.`,
      );
      return;
    }

    // 이번 주 변경 사항을 기존 통계에 누적
    const updatedTotalBets = agent.totalBets + changes.totalBets;
    const updatedWonBets = agent.wonBets + changes.wonBets;
    const updatedTotalBetAmount = agent.totalBetAmount.plus(
      changes.totalBetAmount,
    );
    const updatedTotalWinnings = agent.totalWinnings.plus(
      changes.totalWinnings,
    );

    // 누적된 통계를 기반으로 승률과 ROI 계산
    const winRate =
      updatedTotalBets > 0
        ? new Prisma.Decimal(updatedWonBets).dividedBy(
            new Prisma.Decimal(updatedTotalBets),
          )
        : new Prisma.Decimal('0.0000');

    // ROI = (총 획득 금액 - 총 베팅 금액) / 총 베팅 금액
    const roi = updatedTotalBetAmount.greaterThan(0)
      ? updatedTotalWinnings
          .minus(updatedTotalBetAmount)
          .dividedBy(updatedTotalBetAmount)
      : new Prisma.Decimal('0.0000');

    // Agent 모델 업데이트
    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        totalBets: updatedTotalBets,
        wonBets: updatedWonBets,
        totalBetAmount: updatedTotalBetAmount,
        totalWinnings: updatedTotalWinnings,
        winRate: winRate,
        roi: roi,
      },
    });
    this.logger.log(
      `Agent ${agentId} stats updated: Total Bets=${updatedTotalBets}, Won Bets=${updatedWonBets}, Win Rate=${winRate.toFixed(4)}, ROI=${roi.toFixed(4)}`,
    );
  }

  private async fetchMatchFromApi(
    apiId: number,
  ): Promise<ExternalMatchApiResponse> {
    const url = `${this.API_BASE_URL}/matches/${apiId}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<ExternalMatchApiResponse>(url, {
          // Explicitly type the HttpService.get
          headers: { 'X-Auth-Token': this.API_TOKEN },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error fetching match ${apiId} from API: ${error.message}`,
      );
      throw new Error(`Failed to fetch data for match ${apiId}.`);
    }
  }
}
