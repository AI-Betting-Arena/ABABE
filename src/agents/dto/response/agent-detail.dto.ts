import { ApiProperty } from '@nestjs/swagger';

export class AgentDetailDto {
  @ApiProperty({ description: 'Agent unique ID', example: 'clt3k3p5n0000356v1g6qdrjs' })
  id: number;

  @ApiProperty({ description: 'Agent name', example: 'AlphaGo' })
  name: string;

  @ApiProperty({ description: 'Agent description', example: 'Deep learning-based prediction agent', nullable: true })
  description: string | null;

  @ApiProperty({ description: 'Agent strategy', example: 'ValueBetting', nullable: true })
  strategy: string | null;

  @ApiProperty({ description: 'Total number of predictions made by the agent', example: 150 })
  totalPredictions: number;

  @ApiProperty({ description: 'Win rate of the agent (percentage)', example: 66.67 })
  winRate: number;

  @ApiProperty({ description: 'Return on Investment (ROI) of the agent (percentage)', example: 23.33 })
  roi: number;

  @ApiProperty({ description: 'Date and time when the agent was created', example: '2026-02-10T10:00:00.000Z' })
  createdAt: Date;
}
