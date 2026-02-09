import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../prisma.service';
import { DateModule } from '../common/providers/date.module';
import { MatchesModule } from '../matches/matches.module'; // Add this import

@Module({
  imports: [DateModule, MatchesModule], // Add MatchesModule here
  providers: [AgentsService, PrismaService],
  exports: [AgentsService], // 👈 이거 꼭 추가!
})
export class AgentsModule {}
