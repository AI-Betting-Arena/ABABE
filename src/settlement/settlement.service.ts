import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Match, Prediction, Prisma } from '../generated/prisma/client';
import { MatchStatus } from '../common/constants/match-status.enum';
import { firstValueFrom } from 'rxjs';

// --- Principle: YAGNI (You Aren't Gonna Need It) ---
// 외부 라이브러리(date-fns) 대신 표준 Date 객체로 로직을 구현하여 불필요한 의존성을 제거.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Interface for the external API match response
interface ExternalMatchApiResponse {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'LIVE' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELLED';
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
      throw new Error('FOOTBALL_DATA_API_TOKEN is not defined in the .env file.');
    }
  }

  @Cron('0 4 * * 1', { timeZone: 'UTC' })
  async handleWeeklySettlement() {
    this.logger.log('Weekly settlement process started.');

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
          await this.settleMatch(match);
          this.logger.log(`Successfully settled match ID: ${match.id} (API ID: ${match.apiId})`);
        } catch (error) {
          this.logger.error(
            `Failed to settle match ID: ${match.id} (API ID: ${match.apiId}). Error: ${error.message}`,
          );
          // Continue to the next match
        }
        await delay(this.API_DELAY_MS);
      }
    } catch (error) {
      this.logger.error(`An unexpected error occurred during the weekly settlement process: ${error.message}`, error.stack);
    } finally {
      this.logger.log('Weekly settlement process finished.');
    }
  }

  /**
   * --- Principle: SRP (Single Responsibility Principle) & Transactional Integrity ---
   * 단일 경기의 정산 로직을 책임지며, 모든 DB 변경은 트랜잭션으로 처리.
   */
  private async settleMatch(match: Match): Promise<void> {
    const { id: matchId, apiId } = match;

    // Fetch match result from external API
    const apiMatch = await this.fetchMatchFromApi(apiId);

    if (apiMatch.status !== 'FINISHED' || !apiMatch.score?.winner) {
      // If match is not finished, skip it for now. It will be picked up in the next run.
      this.logger.warn(`Match ${apiId} is not finished yet. Skipping.`);
      return;
    }

    const actualWinner = apiMatch.score.winner; // 'HOME_TEAM', 'AWAY_TEAM', 'DRAW'

    await this.prisma.$transaction(async (tx) => {
      // 1. Fetch all pending predictions for this match
      const predictions = await tx.prediction.findMany({
        where: { matchId: matchId, status: 'PENDING' },
      });

      if (predictions.length === 0) {
        this.logger.log(`No pending predictions for match ${matchId}.`);
      }

      for (const prediction of predictions) {
        const isWin = prediction.prediction === actualWinner;
        const newStatus = isWin ? 'SUCCESS' : 'FAIL';

        // 2. Update prediction status
        await tx.prediction.update({
          where: { id: prediction.id },
          data: { status: newStatus },
        });

        // 3. If win, update agent's balance
        if (isWin) {
          const winnings = new Prisma.Decimal(prediction.betAmount.toString()).times(
            new Prisma.Decimal(prediction.betOdd.toString()),
          );

          await tx.agent.update({
            where: { id: prediction.agentId },
            data: {
              balance: {
                increment: winnings,
              },
            },
          });
        }
      }
      
      // 4. Update match status to SETTLED
      // Note: We need to find the correct enum value for SETTLED from prisma schema.
      // Based on the schema, it's `MatchStatus.SETTLED`
      await tx.match.update({
        where: { id: matchId },
        data: { status: MatchStatus.SETTLED },
      });
    });
  }

  private async fetchMatchFromApi(apiId: number): Promise<ExternalMatchApiResponse> {
    const url = `${this.API_BASE_URL}/matches/${apiId}`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<ExternalMatchApiResponse>(url, { // Explicitly type the HttpService.get
          headers: { 'X-Auth-Token': this.API_TOKEN },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching match ${apiId} from API: ${error.message}`);
      throw new Error(`Failed to fetch data for match ${apiId}.`);
    }
  }
}
