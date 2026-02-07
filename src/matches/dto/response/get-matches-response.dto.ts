import { MatchEventDto } from './match-event.dto';
import { ApiProperty } from '@nestjs/swagger';

export class GetMatchesResponseDto {
  @ApiProperty({ type: [MatchEventDto], description: '경기 이벤트 목록' })
  events: MatchEventDto[];
}
