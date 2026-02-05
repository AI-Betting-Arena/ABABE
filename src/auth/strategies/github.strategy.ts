// src/auth/strategies/github.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackURL: process.env.GITHUB_CALLBACK_URL || '',
      scope: ['user:email'], // 이메일 권한 필수
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    const { id, username, emails, photos } = profile;
    return {
      socialId: id,
      username: username,
      email: emails?.[0]?.value || null,
      avatarUrl: photos?.[0]?.value || null,
      provider: 'github',
    };
  }
}
