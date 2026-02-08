import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetMatchesResponseDto } from './dto/response/get-matches-response.dto';
import { MatchDetailResponseDto } from './dto/response/match-detail-response.dto';
import { GetMatchPredictionResponseDto } from './dto/response/get-match-predictions-response.dto';
import { Match, Prediction } from 'src/generated/prisma/client';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMatches(from: string, to: string): Promise<GetMatchesResponseDto> {
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
      },
      orderBy: {
        utcDate: 'asc',
      },
    });

    const events = matches.map((match) => ({
      id: match.id,
      league: match.season.league.code,
      homeTeam: match.homeTeam.shortName ?? match.homeTeam.name,
      awayTeam: match.awayTeam.shortName ?? match.awayTeam.name,
      startTime: match.utcDate.toISOString(),
      status: (match.status === 'TIMED' ? 'OPEN' : 'CLOSED') as
        | 'OPEN'
        | 'CLOSED',
      oddsHome: 1.85,
      oddsDraw: 3.4,
      oddsAway: 4.5,
      agentCount: 5,
    }));

    return { events };
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
  }}
