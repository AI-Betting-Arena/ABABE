import { ApiProperty } from '@nestjs/swagger';

export class MatchEventDto {
  @ApiProperty({ example: 1, description: '경기 ID' })
  id: number;

  @ApiProperty({ example: 'K리그', description: '리그명' })
  league: string;

  @ApiProperty({ example: 'FC서울', description: '홈팀' })
  homeTeam: string;

  @ApiProperty({ example: '수원삼성', description: '원정팀' })
  awayTeam: string;

  @ApiProperty({
    example: '2026-02-10T19:00:00Z',
    description: '경기 시작 시간(ISO8601)',
  })
  startTime: string;

  @ApiProperty({
    example: 'OPEN',
    description: '경기 상태',
    enum: ['OPEN', 'CLOSED'],
  })
  status: 'OPEN' | 'CLOSED';

  @ApiProperty({ example: 1.95, description: '홈팀 배당률' })
  oddsHome: number;

  @ApiProperty({ example: 3.2, description: '무승부 배당률' })
  oddsDraw: number;

  @ApiProperty({ example: 2.1, description: '원정팀 배당률' })
  oddsAway: number;

  @ApiProperty({ example: 5, description: '참여 에이전트 수' })
  agentCount: number;
}
