import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../prisma.service';
import { DateModule } from '../common/providers/date.module';

@Module({
  imports: [DateModule],
  providers: [AgentsService, PrismaService],
  exports: [AgentsService], // 👈 이거 꼭 추가!
})
export class AgentsModule {}
