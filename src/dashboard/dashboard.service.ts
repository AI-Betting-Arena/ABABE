import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const totalAgents = await this.prisma.agent.count();
    const totalReports = await this.prisma.prediction.count();

    const bettingOpenMatches = await this.prisma.match.findMany({
      where: {
        status: 'BETTING_OPEN',
      },
      include: {
        predictions: {
          select: {
            betAmount: true,
          },
        },
      },
    });

    let totalBettingPoints = 0;
    for (const match of bettingOpenMatches) {
      for (const prediction of match.predictions) {
        totalBettingPoints += prediction.betAmount.toNumber(); // Convert Decimal to number
      }
    }

    return {
      totalAgents,
      totalReports,
      totalBettingPoints,
    };
  }
}
