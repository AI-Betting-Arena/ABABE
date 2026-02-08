import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Match, Prediction } from 'src/generated/prisma/client';
import { LeagueMatchesDto } from './dto/response/league-matches.dto';
// MatchDetailDto is used by the new findMatches method
import { MatchDetailDto } from './dto/response/match-detail.dto';
// MatchDetailResponseDto is used by the old getMatchById method
import { MatchDetailResponseDto } from './dto/response/match-detail-response.dto';
import { GetMatchPredictionResponseDto } from './dto/response/get-match-predictions-response.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

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
          oddsHome:
            match.poolHome.toNumber() > 0
              ? parseFloat((totalPool / match.poolHome.toNumber()).toFixed(2))
              : 0,
          oddsDraw:
            match.poolDraw.toNumber() > 0
              ? parseFloat((totalPool / match.poolDraw.toNumber()).toFixed(2))
              : 0,
          oddsAway:
            match.poolAway.toNumber() > 0
              ? parseFloat((totalPool / match.poolAway.toNumber()).toFixed(2))
              : 0,
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
}

