import { ApiProperty } from '@nestjs/swagger';

export class TeamInfoResponseDto {
  @ApiProperty({ example: 10, description: '팀 ID' })
  id: number;

  @ApiProperty({ example: 'Manchester City', description: '팀 이름' })
  name: string;

  @ApiProperty({ example: 'MCI', description: '팀 약자', nullable: true })
  tla?: string | null;

  @ApiProperty({
    example: 'https://crests.football-data.org/65.png',
    description: '팀 엠블럼 URL',
    nullable: true,
  })
  crest?: string | null;
}
