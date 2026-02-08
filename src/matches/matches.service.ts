import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GetMatchesResponseDto } from './dto/response/get-matches-response.dto';

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
}
