import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'user@example.com', description: '이메일' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password1234', description: '비밀번호' })
  @IsString()
  password: string;

  @ApiProperty({ example: '홍길동', description: '사용자 이름' })
  @IsString()
  username: string;
}
