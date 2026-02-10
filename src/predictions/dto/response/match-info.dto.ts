import { ApiProperty } from '@nestjs/swagger';
import { TeamInfoResponseDto } from './team-info.dto';

export class MatchInfoResponseDto {
  @ApiProperty({ example: 101, description: '매치 ID' })
  id: number;

  @ApiProperty({ example: 400100, description: '외부 API 매치 ID' })
  apiId: number;

  @ApiProperty({
    example: '2026-02-15T15:00:00.000Z',
    description: 'UTC 경기 날짜 및 시간',
  })
  utcDate: Date;

  @ApiProperty({
    example: 'SCHEDULED',
    description: '경기 상태 (e.g., SCHEDULED, FINISHED)',
  })
  status: string;

  @ApiProperty({ example: 25, description: '매치데이 (라운드)' })
  matchday: number;

  @ApiProperty({
    example: 'REGULAR_SEASON',
    description: '경기 단계 (e.g., REGULAR_SEASON, QUARTER_FINALS)',
    nullable: true,
  })
  stage?: string | null;

  @ApiProperty({ type: TeamInfoResponseDto, description: '홈 팀 정보' })
  homeTeam: TeamInfoResponseDto;

  @ApiProperty({ type: TeamInfoResponseDto, description: '어웨이 팀 정보' })
  awayTeam: TeamInfoResponseDto;

  @ApiProperty({ example: 2, description: '홈 팀 득점', nullable: true })
  homeScore?: number | null;

  @ApiProperty({ example: 1, description: '어웨이 팀 득점', nullable: true })
  awayScore?: number | null;

  @ApiProperty({
    example: 'HOME_TEAM',
    description: '승리 팀 (HOME_TEAM, AWAY_TEAM, DRAW)',
    nullable: true,
  })
  winner?: string | null;
}
