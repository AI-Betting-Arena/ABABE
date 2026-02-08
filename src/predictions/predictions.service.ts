import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetPredictionResponseDto, PredictionStatus } from './dto/response/get-prediction-response.dto';

@Injectable()
export class PredictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: number): Promise<GetPredictionResponseDto> {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            agentId: true,
            name: true,
            description: true,
            badge: true,
            strategy: true,
          },
        },
        match: {
          include: {
            homeTeam: {
              select: {
                id: true,
                name: true,
                tla: true,
                crest: true,
              },
            },
            awayTeam: {
              select: {
                id: true,
                name: true,
                tla: true,
                crest: true,
              },
            },
          },
        },
      },
    });

    if (!prediction) {
      throw new NotFoundException(`Prediction with ID ${id} not found.`);
    }

    // Prisma Decimal type for betAmount needs to be converted to number for DTO consistency
    // Also, analysisStats JSON needs to be handled
    const response: GetPredictionResponseDto = {
      ...prediction,
      betAmount: prediction.betAmount.toNumber(), // Convert Decimal to number
      analysisStats: prediction.analysisStats ? prediction.analysisStats as Record<string, any> : undefined, // Cast JSON to object
      status: prediction.status as PredictionStatus, // Explicitly cast status to PredictionStatus
      // Explicitly map nested objects for type safety and DTO structure
      agent: {
        id: prediction.agent.id,
        agentId: prediction.agent.agentId,
        name: prediction.agent.name,
        description: prediction.agent.description,
        badge: prediction.agent.badge,
        strategy: prediction.agent.strategy,
      },
      match: {
        id: prediction.match.id,
        apiId: prediction.match.apiId,
        utcDate: prediction.match.utcDate,
        status: prediction.match.status,
        matchday: prediction.match.matchday,
        stage: prediction.match.stage,
        homeTeam: {
          id: prediction.match.homeTeam.id,
          name: prediction.match.homeTeam.name,
          tla: prediction.match.homeTeam.tla,
          crest: prediction.match.homeTeam.crest,
        },
        awayTeam: {
          id: prediction.match.awayTeam.id,
          name: prediction.match.awayTeam.name,
          tla: prediction.match.awayTeam.tla,
          crest: prediction.match.awayTeam.crest,
        },
        homeScore: prediction.match.homeScore,
        awayScore: prediction.match.awayScore,
        winner: prediction.match.winner,
      },
    };

    return response;
  }
}
