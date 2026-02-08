import { ApiProperty } from '@nestjs/swagger';

export class MatchDetailDto {
  @ApiProperty({ description: '경기의 고유 ID' })
  id: number;

  @ApiProperty({ description: '홈 팀의 고유 ID' })
  homeTeamId: number;

  @ApiProperty({ description: '홈 팀 이름' })
  homeTeamName: string;

  @ApiProperty({ description: '홈 팀 엠블럼 URL', nullable: true })
  homeTeamEmblemUrl: string | null;

  @ApiProperty({ description: '어웨이 팀의 고유 ID' })
  awayTeamId: number;

  @ApiProperty({ description: '어웨이 팀 이름' })
  awayTeamName: string;

  @ApiProperty({ description: '어웨이 팀 엠블럼 URL', nullable: true })
  awayTeamEmblemUrl: string | null;

  @ApiProperty({ description: '경기 시작 시간 (ISO 8601 형식)' })
  startTime: Date;

  @ApiProperty({ description: '경기 상태', example: 'TIMED' })
  status: string;

  @ApiProperty({ description: '홈 팀 승리 배당률' })
  oddsHome: number;

  @ApiProperty({ description: '무승부 배당률' })
  oddsDraw: number;

  @ApiProperty({ description: '어웨이 팀 승리 배당률' })
  oddsAway: number;

  @ApiProperty({ description: '예측에 참여한 에이전트 수' })
  agentCount: number;
}
