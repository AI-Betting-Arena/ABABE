import { ApiProperty } from '@nestjs/swagger';

class TeamDto {
  @ApiProperty({ description: '팀의 고유 ID' })
  id: number;

  @ApiProperty({ description: '외부 API 팀 ID' })
  apiId: number;

  @ApiProperty({ description: '팀 이름' })
  name: string;

  @ApiProperty({ description: '팀 약어', nullable: true })
  shortName: string | null;

  @ApiProperty({ description: '팀 코드 (예: ARS)', nullable: true })
  tla: string | null;

  @ApiProperty({ description: '팀 엠블럼 URL', nullable: true })
  crest: string | null;
}

class LeagueDto {
  @ApiProperty({ description: '리그의 고유 ID' })
  id: number;

  @ApiProperty({ description: '외부 API 리그 ID' })
  apiId: number;

  @ApiProperty({ description: '리그 이름' })
  name: string;

  @ApiProperty({ description: '리그 코드 (예: PL)' })
  code: string;

  @ApiProperty({ description: '리그 타입 (예: CUP, LEAGUE)', nullable: true })
  type: string | null;

  @ApiProperty({ description: '리그 엠블럼 URL', nullable: true })
  emblem: string | null;

  @ApiProperty({ description: '지역 이름', nullable: true })
  areaName: string | null;

  @ApiProperty({ description: '지역 코드', nullable: true })
  areaCode: string | null;

  @ApiProperty({ description: '지역 플래그 URL', nullable: true })
  areaFlag: string | null;
}

class SeasonDto {
  @ApiProperty({ description: '시즌의 고유 ID' })
  id: number;

  @ApiProperty({ description: '외부 API 시즌 ID' })
  apiId: number;

  @ApiProperty({ description: '시즌 시작일 (UTC)' })
  startDate: Date;

  @ApiProperty({ description: '시즌 종료일 (UTC)' })
  endDate: Date;

  @ApiProperty({ type: () => LeagueDto, description: '시즌이 속한 리그 정보' })
  league: LeagueDto;
}

export class MatchDetailResponseDto {
  @ApiProperty({ description: '경기의 고유 ID' })
  id: number;

  @ApiProperty({ description: '외부 API 경기 ID' })
  apiId: number;

  @ApiProperty({ description: '경기 UTC 일시' })
  utcDate: Date;

  @ApiProperty({ description: '경기 상태 (예: FINISHED, SCHEDULED)' })
  status: string;

  @ApiProperty({ description: '매치데이' })
  matchday: number;

  @ApiProperty({
    description: '경기 단계 (예: REGULAR_SEASON)',
    nullable: true,
  })
  stage: string | null;

  @ApiProperty({ type: () => TeamDto, description: '홈 팀 정보' })
  homeTeam: TeamDto;

  @ApiProperty({ type: () => TeamDto, description: '어웨이 팀 정보' })
  awayTeam: TeamDto;

  @ApiProperty({
    description: '경기 승리팀 (HOME_TEAM, AWAY_TEAM, DRAW, null)',
    nullable: true,
  })
  winner: string | null;

  @ApiProperty({ description: '홈 팀 점수', nullable: true })
  homeScore: number | null;

  @ApiProperty({ description: '어웨이 팀 점수', nullable: true })
  awayScore: number | null;

  @ApiProperty({ description: '홈팀 승리 베팅 풀' })
  poolHome: number;

  @ApiProperty({ description: '무승부 베팅 풀' })
  poolDraw: number;

  @ApiProperty({ description: '어웨이팀 승리 베팅 풀' })
  poolAway: number;

  @ApiProperty({ type: () => SeasonDto, description: '경기가 속한 시즌 정보' })
  season: SeasonDto;

  @ApiProperty({ description: '경기 생성일' })
  createdAt: Date;

  @ApiProperty({ description: '경기 수정일' })
  updatedAt: Date;
}
