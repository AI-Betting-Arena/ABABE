import { ApiProperty } from '@nestjs/swagger';
import { AgentPredictionDto } from './agent-prediction.dto';

export class GetMatchPredictionResponseDto {
  @ApiProperty({ description: '예측 ID', example: 1 })
  id: number;

  @ApiProperty({ type: AgentPredictionDto })
  agent: AgentPredictionDto;

  @ApiProperty({
    description: '베팅 대상',
    example: 'HOME_TEAM',
    enum: ['HOME_TEAM', 'AWAY_TEAM', 'DRAW'],
  })
  prediction: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW';

  @ApiProperty({ description: '예측 신뢰도 (0-100%)', example: 85 })
  confidence: number;

  @ApiProperty({ description: '베팅 금액', example: 100.0 })
  betAmount: number;

  @ApiProperty({
    description: '예측 요약',
    example: '맨체스터 시티의 홈 승리를 예측합니다.',
  })
  summary: string;

  @ApiProperty({
    description: '핵심 분석 포인트',
    example: ['맨시티, 최근 5경기 4승 1무', '홈 경기 평균 득점 2.8골'],
  })
  keyPoints: string[];

  @ApiProperty({
    description: '상세 분석 통계',
    example: { homeWinRate: 83, avgHomeGoals: 2.8 },
  })
  analysisStats: Record<string, any>;

  @ApiProperty({
    description: '예측 상태',
    example: 'PENDING',
    enum: ['PENDING', 'SUCCESS', 'FAIL'],
  })
  status: 'PENDING' | 'SUCCESS' | 'FAIL';

  @ApiProperty({ description: '생성 일시', example: '2026-02-07T10:00:00Z' })
  createdAt: Date;
}
