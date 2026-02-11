// src/agents/dto/response/my-agent-detail.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Agent } from 'src/generated/prisma/client'; 

export class MyAgentDetailDto {
  @ApiProperty({ description: 'Agent unique ID (internal)', example: 1 })
  id: number;

  @ApiProperty({ description: 'Public ID of the agent', example: 'agent_177...' })
  agentId: string; 

  @ApiProperty({ description: 'Secret key of the agent (handle with care)', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  secretKey: string; // Added secretKey

  @ApiProperty({ description: 'Agent name', example: 'AlphaGo' })
  name: string;


  @ApiProperty({ description: 'Agent description', example: 'Deep learning-based prediction agent', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Agent badge', example: 'Expert', nullable: true })
  badge: string | null; 

  @ApiProperty({ description: 'Agent strategy', example: 'ValueBetting', nullable: true })
  strategy: string | null;

  @ApiProperty({ description: 'Current balance of the agent', example: 1000.50 })
  balance: number; 

  @ApiProperty({ description: 'Total number of bets made by the agent', example: 150 })
  totalBets: number; 

  @ApiProperty({ description: 'Total number of bets won by the agent', example: 100 })
  wonBets: number; 

  @ApiProperty({ description: 'Total amount of money bet by the agent', example: 1500.75 })
  totalBetAmount: number; 

  @ApiProperty({ description: 'Total winnings accumulated by the agent', example: 2000.00 })
  totalWinnings: number; 

  @ApiProperty({ description: 'Win rate of the agent (e.g., 0.6667 for 66.67%)', example: 0.6667 })
  winRate: number;

  @ApiProperty({ description: 'Return on Investment (ROI) of the agent (e.g., 0.2333 for 23.33%)', example: 0.2333 })
  roi: number;

  @ApiProperty({ description: 'Date and time when the agent was created', example: '2026-02-10T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Date and time when the agent was last updated', example: '2026-02-10T11:00:00.000Z' })
  updatedAt: Date; 

  static fromPrisma(agent: Agent): MyAgentDetailDto {
    const dto = new MyAgentDetailDto();
    dto.id = agent.id;
    dto.agentId = agent.agentId;
    dto.secretKey = agent.secretKey; // Added secretKey mapping
    dto.name = agent.name;
    dto.description = agent.description;
    dto.badge = agent.badge;
    dto.strategy = agent.strategy;
    dto.balance = agent.balance ? agent.balance.toNumber() : 0;
    dto.totalBets = agent.totalBets;
    dto.wonBets = agent.wonBets;
    dto.totalBetAmount = agent.totalBetAmount ? agent.totalBetAmount.toNumber() : 0;
    dto.totalWinnings = agent.totalWinnings ? agent.totalWinnings.toNumber() : 0;
    dto.winRate = agent.winRate ? agent.winRate.toNumber() : 0;
    dto.roi = agent.roi ? agent.roi.toNumber() : 0;
    dto.createdAt = agent.createdAt;
    dto.updatedAt = agent.updatedAt;
    return dto;
  }
}
