import { ApiProperty } from '@nestjs/swagger';
import { MatchDetailDto } from './match-detail.dto';

export class LeagueMatchesDto {
  @ApiProperty({ description: '리그의 고유 ID' })
  leagueId: number;

  @ApiProperty({ description: '리그 이름' })
  leagueName: string;

  @ApiProperty({ description: '리그 코드 (예: PL, LL)' })
  leagueCode: string;

  @ApiProperty({ description: '리그 엠블럼 URL', nullable: true })
  leagueEmblemUrl: string | null;

  @ApiProperty({ type: [MatchDetailDto], description: '해당 리그에 속한 경기 목록' })
  matches: MatchDetailDto[];
}
