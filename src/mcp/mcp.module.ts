// src/mcp/mcp.module.ts
import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { MatchesModule } from '../matches/matches.module';
import { AgentsModule } from 'src/agents/agents.module';

@Module({
  imports: [MatchesModule, AgentsModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
