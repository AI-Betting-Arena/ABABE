// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginRequestDto } from './dto/request/login-request.dto';
import {
  InternalLoginResult,
  InternalSocialUser,
} from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    // 1. Redis: 토큰 세션 관리 (1인 1계정 제어용)
    @InjectRedis() private readonly redis: Redis,

    // 2. JWT: Access/Refresh 토큰 생성 및 검증
    private readonly jwtService: JwtService,

    // 3. Prisma: 유저 데이터 persistence 처리
    private readonly prisma: PrismaService,
  ) {}

  /**
   * [회원가입]
   * 중복 이메일 체크 후 유저 생성
   */
  async register(dto: RegisterRequestDto): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('이미 존재하는 이메일이야.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        username: dto.username,
        provider: 'local',
        socialId: 'local',
      },
    });
  }

  /**
   * [로그인]
   * 유저 검증, 토큰 발급, Redis 세션 갱신
   */
  async login(dto: LoginRequestDto): Promise<InternalLoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // 비밀번호 검증 (현재는 평문 비교)
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 일치하지 않아.');
    }

    const payload = { sub: user.id, email: user.email };

    // Access Token (1시간) / Refresh Token (7일) 생성
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Redis 저장: 1인 1계정 강제 (기존 토큰 무효화)
    const TTL = 7 * 24 * 60 * 60; // 7일 (초 단위)
    await this.redis.set(`refresh_token:${user.id}`, refreshToken, 'EX', TTL);

    return { accessToken, refreshToken, user };
  }

  /**
   * [토큰 갱신]
   * Redis 내 토큰과 대조하여 보안성 확보
   */
  async validateRefreshToken(
    userId: number,
    refreshToken: string,
  ): Promise<boolean> {
    const savedToken = await this.redis.get(`refresh_token:${userId}`);

    if (!savedToken || savedToken !== refreshToken) {
      throw new UnauthorizedException(
        '세션이 만료되었거나 다른 기기에서 로그인했어.',
      );
    }

    return true;
  }

  async validateSocialUser(
    protoUser: InternalSocialUser,
  ): Promise<InternalLoginResult> {
    const { email, socialId, provider, username, avatarUrl } = protoUser;

    // 1. 소셜 계정 존재 확인
    let user = await this.prisma.user.findUnique({
      where: { socialId_provider: { socialId, provider } }, // Prisma 복합 유니크 설정 필요
    });

    if (!user) {
      // 2. 이메일 중복 체크 (로컬 가입자와 충돌 방지)
      const emailExists = await this.prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        throw new ConflictException(
          '이미 로컬 계정으로 가입된 이메일이야. 로컬 로그인을 이용해줘.',
        );
      }

      // 3. 신규 소셜 가입
      user = await this.prisma.user.create({
        data: {
          email,
          username,
          avatarUrl,
          provider,
          socialId,
          password: '', // 소셜 계정은 비밀번호 미사용
        },
      });
    }

    // 4. 토큰 발급 (기존 로직 재사용)
    return this.generateAuthTokens(user);
  }

  // [DRY] 토큰 생성 로직 분리
  private async generateAuthTokens(user: any): Promise<InternalLoginResult> {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.redis.set(
      `refresh_token:${user.id}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60,
    );

    return { accessToken, refreshToken, user };
  }
}
