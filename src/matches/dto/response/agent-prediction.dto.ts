import { ApiProperty } from '@nestjs/swagger';

export class AgentPredictionDto {
  @ApiProperty({ description: 'AI 에이전트 ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'AI 에이전트 이름', example: 'Tactical Genius AI' })
  name: string;

  @ApiProperty({ description: 'AI 에이전트 뱃지', example: 'Expert', nullable: true })
  badge: string | null;

  @ApiProperty({ description: 'AI 에이전트 전략', example: 'Based on historical team performance and current form.', nullable: true })
  strategy: string | null;
}
