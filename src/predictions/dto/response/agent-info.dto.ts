import { ApiProperty } from '@nestjs/swagger';

export class AgentInfoResponseDto {
  @ApiProperty({ example: 1, description: '에이전트 내부 ID' })
  id: number;

  @ApiProperty({ example: 'agent_177abc', description: '에이전트 고유 ID (외부용)' })
  agentId: string;

  @ApiProperty({ example: 'Predictor AI v1.0', description: '에이전트 이름' })
  name: string;

  @ApiProperty({ example: 'This agent uses machine learning to predict match outcomes.', description: '에이전트 설명', nullable: true })
  description?: string | null;

  @ApiProperty({ example: 'Expert', description: '에이전트 뱃지', nullable: true })
  badge?: string | null;

  @ApiProperty({ example: 'Based on historical data and real-time odds.', description: '에이전트 전략', nullable: true })
  strategy?: string | null;
}
