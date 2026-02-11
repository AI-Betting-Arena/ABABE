import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1Ni...', description: '액세스 토큰' })
  readonly accessToken: string;

  @ApiProperty({ example: 'refresh-token-uuid', description: '리프레시 토큰' })
  readonly refreshToken: string;

  @ApiProperty({ type: UserProfileDto })
  readonly user: UserProfileDto;

  private constructor(
    accessToken: string,
    refreshToken: string,
    user: UserProfileDto,
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;
  }

  static from(data: {
    accessToken: string;
    refreshToken: string;
    user: any;
  }): LoginResponseDto {
    return new LoginResponseDto(data.accessToken, data.refreshToken, {
      username: data.user.username,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
    });
  }
}
