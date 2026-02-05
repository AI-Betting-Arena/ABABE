export interface InternalLoginResult {
  accessToken: string;
  refreshToken: string;
  user: any; // 추후 Prisma User 타입으로 교체
}

export interface InternalSocialUser {
  socialId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  provider: 'github' | 'google'; // 확장성 고려
}
