import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Match, Prediction, Prisma } from 'src/generated/prisma/client'; // Add Prisma for Decimal type
import { LeagueMatchesDto } from './dto/response/league-matches.dto';
// MatchDetailDto is used by the new findMatches method
import { MatchDetailDto } from './dto/response/match-detail.dto';
// MatchDetailResponseDto is used by the old getMatchById method
import { MatchDetailResponseDto } from './dto/response/match-detail-response.dto';
import { GetMatchPredictionResponseDto } from './dto/response/get-match-predictions-response.dto';
import { MatchStatus } from '../common/constants/match-status.enum'; // Import MatchStatus
import { Cron } from '@nestjs/schedule'; // Import Cron

// Define virtual seed pools for odds calculation to ensure balance and prevent division by zero.
const VIRTUAL_HOME_AWAY_POOL = new Prisma.Decimal(1000);
const VIRTUAL_DRAW_POOL = new Prisma.Decimal(800);

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name); // Add logger

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * 1', { timeZone: 'Etc/UTC' }) // 매주 월요일 00:00 UTC
  async handleWeeklyMatchStatusUpdate() {
    this.logger.log('Starting weekly match status update...');
    try {
      const updatedCount = await this.updateUpcomingMatchesToBettingOpen();
      this.logger.log(`Weekly match status update completed. ${updatedCount} matches updated.`);
    } catch (error) {
      this.logger.error(
        `Failed to complete weekly match status update: ${error.message}`,
        error.stack,
      );
    }
  }

  async updateUpcomingMatchesToBettingOpen(): Promise<number> {
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // 0(일) ~ 6(토)

    // 이번 주 월요일 00:00:00 UTC
    const startDate = new Date(today);
    startDate.setUTCDate(today.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startDate.setUTCHours(0, 0, 0, 0);

    // 이번 주 일요일 23:59:59.999 UTC
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);

    this.logger.debug(
      `Attempting to update matches from ${startDate.toISOString()} to ${endDate.toISOString()} to ${MatchStatus.BETTING_OPEN}...`,
    );

    try {
      const result = await this.prisma.match.updateMany({
        where: {
          utcDate: {
            gte: startDate,
            lte: endDate,
          },
          status: MatchStatus.UPCOMING,
        },
        data: {
          status: MatchStatus.BETTING_OPEN,
        },
      });
      this.logger.log(
        `✅ ${result.count} matches updated to ${MatchStatus.BETTING_OPEN} for the week ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}.`,
      );
      return result.count;
    } catch (error) {
      this.logger.error(
        `❌ Error updating match statuses: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findMatches(from: string, to: string): Promise<LeagueMatchesDto[]> {
    const startDate = new Date(from);
    const endDate = new Date(`${to}T23:59:59.999Z`);

    const matches = await this.prisma.match.findMany({
      where: {
        utcDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        season: {
          include: {
            league: true,
          },
        },
        homeTeam: true,
        awayTeam: true,
        predictions: { // Include predictions to count them
          select: { id: true },
        },
      },
      orderBy: {
        utcDate: 'asc',
      },
    });

    const groupedByLeague = matches.reduce(
      (acc, match) => {
        const league = acc.find((l) => l.leagueId === match.season.leagueId);
        const totalPool =
          match.poolHome.toNumber() +
          match.poolDraw.toNumber() +
          match.poolAway.toNumber();

        const matchDetail: MatchDetailDto = {
          id: match.id,
          homeTeamId: match.homeTeam.id,
          homeTeamName: match.homeTeam.name,
          homeTeamEmblemUrl: match.homeTeam.crest,
          awayTeamId: match.awayTeam.id,
          awayTeamName: match.awayTeam.name,
          awayTeamEmblemUrl: match.awayTeam.crest,
          startTime: match.utcDate,
          status: match.status,
          // Use stored odds from the match object
          oddsHome: match.oddsHome.toNumber(),
          oddsDraw: match.oddsDraw.toNumber(),
          oddsAway: match.oddsAway.toNumber(),
          agentCount: match.predictions.length, // Use actual count of predictions
        };

        if (league) {
          league.matches.push(matchDetail);
        } else {
          acc.push({
            leagueId: match.season.league.id,
            leagueName: match.season.league.name,
            leagueCode: match.season.league.code,
            leagueEmblemUrl: match.season.league.emblem,
            matches: [matchDetail],
          });
        }
        return acc;
      },
      [] as LeagueMatchesDto[],
    );

    return groupedByLeague;
  }

  async getMatchById(id: number): Promise<MatchDetailResponseDto> {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: {
          include: {
            league: true,
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    const matchDetail: MatchDetailResponseDto = {
      id: match.id,
      apiId: match.apiId,
      utcDate: match.utcDate,
      status: match.status,
      matchday: match.matchday,
      stage: match.stage,
      homeTeam: {
        id: match.homeTeam.id,
        apiId: match.homeTeam.apiId,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
        tla: match.homeTeam.tla,
        crest: match.homeTeam.crest,
      },
      awayTeam: {
        id: match.awayTeam.id,
        apiId: match.awayTeam.apiId,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
        tla: match.awayTeam.tla,
        crest: match.awayTeam.crest,
      },
      winner: match.winner,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      poolHome: match.poolHome.toNumber(),
      poolDraw: match.poolDraw.toNumber(),
      poolAway: match.poolAway.toNumber(),
      season: {
        id: match.season.id,
        apiId: match.season.apiId,
        startDate: match.season.startDate,
        endDate: match.season.endDate,
        league: {
          id: match.season.league.id,
          apiId: match.season.league.apiId,
          name: match.season.league.name,
          code: match.season.league.code,
          type: match.season.league.type,
          emblem: match.season.league.emblem,
          areaName: match.season.league.areaName,
          areaCode: match.season.league.areaCode,
          areaFlag: match.season.league.areaFlag,
        },
      },
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };

    return matchDetail;
  }

  async getMatchPredictions(
    matchId: number,
  ): Promise<GetMatchPredictionResponseDto[]> {
    const predictions = await this.prisma.prediction.findMany({
      where: {
        matchId: matchId,
      },
      include: {
        agent: true,
      },
    });

    if (!predictions || predictions.length === 0) {
      return [];
    }

    return predictions.map((p) => ({
      id: p.id,
      agent: {
        id: p.agent.id,
        name: p.agent.name,
        badge: p.agent.badge,
        strategy: p.agent.strategy,
      },
      prediction: p.prediction as 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW',
      confidence: p.confidence,
      betAmount: p.betAmount.toNumber(),
      summary: p.summary,
      keyPoints: p.keyPoints,
      analysisStats: p.analysisStats as Record<string, any>,
      status: p.status as 'PENDING' | 'SUCCESS' | 'FAIL',
      createdAt: p.createdAt,
    }));
  }

  /**
   * Calculates and sets the betting odds for a given match.
   * Updates the betting pools and recalculates the odds based on the new bet.
   * Includes a virtual pool mechanism to prevent division by zero when a pool is empty.
   *
   * @param matchId The ID of the match.
   * @param betAmount The amount of the bet.
   * @param betType The type of bet ('HOME_TEAM', 'DRAW', or 'AWAY_TEAM').
   * @returns An object containing the calculated odds for home, draw, and away.
   */
  async calculateAndSetOdds(
    matchId: number,
    betAmount: Prisma.Decimal,
    betType: 'HOME_TEAM' | 'DRAW' | 'AWAY_TEAM',
  ): Promise<{ oddsHome: Prisma.Decimal; oddsDraw: Prisma.Decimal; oddsAway: Prisma.Decimal }> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found`);
    }

    // Update the actual pool based on the new bet
    let updatedPoolHome = match.poolHome;
    let updatedPoolDraw = match.poolDraw;
    let updatedPoolAway = match.poolAway;

    switch (betType) {
      case 'HOME_TEAM':
        updatedPoolHome = match.poolHome.plus(betAmount);
        break;
      case 'DRAW':
        updatedPoolDraw = match.poolDraw.plus(betAmount);
        break;
      case 'AWAY_TEAM':
        updatedPoolAway = match.poolAway.plus(betAmount);
        break;
      default:
        throw new Error('Invalid bet type');
    }

    // --- Core Logic Change: Always add virtual seed pool for calculation ---
    const effectivePoolHome = updatedPoolHome.plus(VIRTUAL_HOME_AWAY_POOL);
    const effectivePoolDraw = updatedPoolDraw.plus(VIRTUAL_DRAW_POOL);
    const effectivePoolAway = updatedPoolAway.plus(VIRTUAL_HOME_AWAY_POOL);

    // Calculate total effective pool
    const totalEffectivePool = effectivePoolHome.plus(effectivePoolDraw).plus(effectivePoolAway);

    // Commission (10%)
    const commissionMultiplier = new Prisma.Decimal(0.9);

    // Calculate new odds based on the effective pools
    const newOddsHome = totalEffectivePool.times(commissionMultiplier).dividedBy(effectivePoolHome).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const newOddsDraw = totalEffectivePool.times(commissionMultiplier).dividedBy(effectivePoolDraw).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const newOddsAway = totalEffectivePool.times(commissionMultiplier).dividedBy(effectivePoolAway).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    // Update the match with the REAL new pools and calculated odds
    await this.prisma.match.update({
      where: { id: matchId },
      data: {
        poolHome: updatedPoolHome,
        poolDraw: updatedPoolDraw,
        poolAway: updatedPoolAway,
        oddsHome: newOddsHome,
        oddsDraw: newOddsDraw,
        oddsAway: newOddsAway,
      },
    });

    return { oddsHome: newOddsHome, oddsDraw: newOddsDraw, oddsAway: newOddsAway };
  }
}

