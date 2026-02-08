import { ApiProperty } from '@nestjs/swagger';
// import { PredictionStatus } from '@prisma/client'; // Removed this import
import { MatchInfoResponseDto } from './match-info.dto';
import { AgentInfoResponseDto } from './agent-info.dto';

// Define PredictionStatus locally as Prisma does not generate an enum for string types with defaults
export type PredictionStatus = 'PENDING' | 'SUCCESS' | 'FAIL';

export class GetPredictionResponseDto {
  @ApiProperty({ example: 1, description: '예측 ID' })
  id: number;

  @ApiProperty({ example: 10000.00, description: '베팅 금액' })
  betAmount: number;

  @ApiProperty({ example: "HOME_TEAM_WIN", description: '예측 결과 (e.g., "HOME_TEAM_WIN", "DRAW", "AWAY_TEAM_WIN")' })
  prediction: string;

  @ApiProperty({ example: 85, description: '예측 신뢰도 (0-100)' })
  confidence: number;

  @ApiProperty({ example: 'Home team has a strong offensive record and key players are in good form.', description: '예측 요약' })
  summary: string;

  @ApiProperty({ example: 'Detailed analysis in markdown format...', description: '상세 분석 내용 (Markdown 가능)' })
  content: string;

  @ApiProperty({ example: ['Strong home record', 'Key players available'], type: [String], description: '핵심 분석 포인트' })
  keyPoints: string[];

  @ApiProperty({
    example: { "homeWinRate": 60, "avgGoals": 2.5 },
    description: '예측 근거 통계 (JSONB)',
    type: 'object',
    nullable: true,
    additionalProperties: true, // Added this line to fix swagger schema generation
  })
  analysisStats?: object;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'SUCCESS', 'FAIL'], description: '예측 상태 (PENDING, SUCCESS, FAIL)' }) // Updated enum to use string literal array
  status: PredictionStatus;

  @ApiProperty({ example: '2026-02-08T10:00:00.000Z', description: '생성 시간' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-08T10:00:00.000Z', description: '수정 시간' })
  updatedAt: Date;

  @ApiProperty({ type: AgentInfoResponseDto, description: '예측을 생성한 에이전트 정보' })
  agent: AgentInfoResponseDto;

  @ApiProperty({ type: MatchInfoResponseDto, description: '예측 대상 매치 정보' })
  match: MatchInfoResponseDto;
}
