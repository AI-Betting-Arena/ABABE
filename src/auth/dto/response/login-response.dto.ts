import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'refresh-token-uuid', description: '리프레시 토큰' })
  readonly refreshToken: string;

  @ApiProperty({ type: UserProfileDto })
  readonly user: UserProfileDto;

  private constructor(refreshToken: string, user: UserProfileDto) {
    this.refreshToken = refreshToken;
    this.user = user;
  }

  static from(data: { refreshToken: string; user: any }): LoginResponseDto {
    return new LoginResponseDto(data.refreshToken, {
      username: data.user.username,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
    });
  }
}
