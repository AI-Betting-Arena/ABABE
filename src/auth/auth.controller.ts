// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/request/register-request.dto';
import { LoginRequestDto } from './dto/request/login-request.dto';
import { LoginResponseDto } from './dto/response/login-response.dto';
import { AuthGuard } from '@nestjs/passport';
import { InternalSocialUser } from './interfaces/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * [회원가입]
   * 단순 성공 메시지 반환
   */
  @Post('register')
  @ApiOperation({ summary: '회원가입', description: '회원가입을 진행합니다.' })
  @ApiBody({ type: RegisterRequestDto })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    schema: { example: { message: '회원가입이 완료되었어.' } },
  })
  async register(@Body() registerDto: RegisterRequestDto) {
    await this.authService.register(registerDto);
    return { message: '회원가입이 완료되었어.' };
  }

  /**
   * [로그인]
   * AccessToken은 쿠키로, 나머지는 DTO로 반환
   */
  @Post('login')
  @ApiOperation({ summary: '로그인', description: '로그인 시도 및 토큰 발급' })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 201,
    description: '로그인 성공',
    type: LoginResponseDto,
  })
  async login(
    @Body() loginDto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(loginDto);

    // Access Token 쿠키 세팅 (HttpOnly로 보안 강화)
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: false, // 로컬 개발 환경
      sameSite: 'lax',
      maxAge: 3600000, // 1시간
    });

    // 정적 팩터리 메서드로 응답 DTO 생성
    return LoginResponseDto.from(result);
  }

  @Get('github')
  @ApiOperation({
    summary: '깃허브 소셜 로그인',
    description: '깃허브 OAuth 인증 시작',
  })
  @ApiResponse({
    status: 302,
    description: '깃허브 로그인 페이지로 리다이렉트',
  })
  @UseGuards(AuthGuard('github'))
  async githubAuth() {
    // GitHub 로그인 페이지로 리다이렉트
  }

  @Get('github/callback')
  @ApiOperation({
    summary: '깃허브 소셜 로그인 콜백',
    description: '깃허브 OAuth 인증 후 콜백',
  })
  @ApiResponse({ status: 302, description: '프론트엔드로 리다이렉트' })
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: Request & { user: InternalSocialUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.validateSocialUser(req.user);

    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: false,
      maxAge: 3600000,
    });

    res.redirect(
      `${process.env.FRONTEND_LOGIN_SUCCESS_URL}?refreshToken=${result.refreshToken}`,
    );
  }
}
