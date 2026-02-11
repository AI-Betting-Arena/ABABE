import { ApiProperty } from '@nestjs/swagger';
import { League } from 'src/generated/prisma/client';

export class LeagueInfoResponseDto {
  @ApiProperty({ description: 'League unique ID', example: 2021 })
  id: number;

  @ApiProperty({ description: 'League name', example: 'Premier League' })
  name: string;

  @ApiProperty({ description: 'League code (e.g., PL)', example: 'PL' })
  code: string;

  @ApiProperty({ description: 'URL to the league emblem', example: 'http://example.com/premier_league_emblem.png', nullable: true })
  emblem: string | null;

  static fromPrisma(league: League): LeagueInfoResponseDto {
    const dto = new LeagueInfoResponseDto();
    dto.id = league.id;
    dto.name = league.name;
    dto.code = league.code;
    dto.emblem = league.emblem;
    return dto;
  }
}
