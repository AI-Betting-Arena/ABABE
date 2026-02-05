import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsUrl } from 'class-validator';

export class UserProfileDto {
  @ApiProperty({ example: '홍길동', description: '사용자 이름' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'https://example.com/avatar.png',
    description: '아바타 URL',
    nullable: true,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl: string | null;
}
