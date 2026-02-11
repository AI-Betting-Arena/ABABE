import { ApiProperty } from '@nestjs/swagger';
import { Team } from 'src/generated/prisma/client';

export class TeamInfoResponseDto {
  @ApiProperty({ description: 'Team unique ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Team name', example: 'Manchester City' })
  name: string;

  @ApiProperty({ description: 'Short name of the team (e.g., Man City)', example: 'Man City', nullable: true })
  shortName: string | null;

  @ApiProperty({ description: 'URL to the team crest image', example: 'http://example.com/man_city_crest.png', nullable: true })
  crest: string | null;

  static fromPrisma(team: Team): TeamInfoResponseDto {
    const dto = new TeamInfoResponseDto();
    dto.id = team.id;
    dto.name = team.name;
    dto.shortName = team.shortName;
    dto.crest = team.crest;
    return dto;
  }
}
