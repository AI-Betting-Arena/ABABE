import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetMatchesRequestDto {
  @ApiProperty({
    example: '2026-02-09',
    description: '조회 시작 날짜 (YYYY-MM-DD)',
    default: '2026-02-09',
  })
  @IsNotEmpty()
  @IsDateString()
  from: string;

  @ApiProperty({
    example: '2026-02-15',
    description: '조회 종료 날짜 (YYYY-MM-DD)',
    default: '2026-02-15',
  })
  @IsNotEmpty()
  @IsDateString()
  to: string;
}
