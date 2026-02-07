import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [AgentsService, PrismaService],
  exports: [AgentsService], // 👈 이거 꼭 추가!
})
export class AgentsModule {}
