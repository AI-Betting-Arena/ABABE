import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { PrismaService } from '../prisma.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [SettlementService, PrismaService],
  exports: [SettlementService],
})
export class SettlementModule {}
