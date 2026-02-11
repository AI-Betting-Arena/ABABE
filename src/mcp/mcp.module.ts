import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { MatchesModule } from '../matches/matches.module';
import { AgentsModule } from 'src/agents/agents.module';
import { SettlementModule } from 'src/settlement/settlement.module';
import { DateModule } from 'src/common/providers/date.module'; // Import DateModule

@Module({
  imports: [MatchesModule, AgentsModule, SettlementModule, DateModule], // Add DateModule here
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
