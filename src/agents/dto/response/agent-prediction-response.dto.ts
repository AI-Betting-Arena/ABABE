import { ApiProperty } from '@nestjs/swagger';
import { Prediction, Match, Team, League } from 'src/generated/prisma/client';
import { MatchInfoForPredictionResponseDto } from 'src/matches/dto/response/match-info-for-prediction-response.dto';

export class AgentPredictionResponseDto {
  @ApiProperty({ description: 'Prediction unique ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Predicted outcome (e.g., HOME_TEAM, AWAY_TEAM, DRAW)', example: 'HOME_TEAM' })
  prediction: string;

  @ApiProperty({ description: 'Confidence level of the prediction (0-100)', example: 85 })
  confidence: number;

  @ApiProperty({ description: 'Amount bet on this prediction', example: 10.00 })
  betAmount: number;

  @ApiProperty({ description: 'Betting odd for this prediction', example: 1.55 })
  betOdd: number;

  @ApiProperty({ description: 'Status of the prediction (PENDING, SUCCESS, FAIL)', example: 'SUCCESS' })
  status: string;

  @ApiProperty({ description: 'Concise summary of the analysis', example: '맨시티는 최근 폼이 좋고 홈에서 강합니다.' })
  summary: string;

  @ApiProperty({ description: 'Three key analysis points', type: [String], example: ['맨시티 홈 경기 10연승', '상대 팀 주전 공격수 부상', '역대 전적 압도적 우위'] })
  keyPoints: string[];

  @ApiProperty({
    description: 'Prediction basis statistics (e.g., { "homeWinRate": 60, "avgGoals": 2.5 })',
    example: { homeWinRate: 83, avgGoals: 3.2 },
    nullable: true,
  })
  analysisStats: object | null;

  @ApiProperty({ description: 'Date and time when the prediction was created', example: '2026-02-10T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: MatchInfoForPredictionResponseDto, description: 'Match information for this prediction' })
  match: MatchInfoForPredictionResponseDto;

  static fromPrisma(
    prediction: Prediction & { match: Match & { homeTeam: Team; awayTeam: Team; season: { league: League } } },
  ): AgentPredictionResponseDto {
    const dto = new AgentPredictionResponseDto();
    dto.id = prediction.id;
    dto.prediction = prediction.prediction;
    dto.confidence = prediction.confidence;
    dto.betAmount = prediction.betAmount.toNumber();
    dto.betOdd = prediction.betOdd.toNumber();
    dto.status = prediction.status;
    dto.summary = prediction.summary;
    dto.keyPoints = prediction.keyPoints;
    dto.analysisStats = prediction.analysisStats ? (prediction.analysisStats as object) : null;
    dto.createdAt = prediction.createdAt;
    dto.match = MatchInfoForPredictionResponseDto.fromPrisma(prediction.match);
    return dto;
  }
}
