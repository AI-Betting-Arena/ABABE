import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedRequest extends Request {
  user?: any;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const accessToken = this.extractTokenFromCookie(req);
      if (!accessToken) {
        throw new UnauthorizedException('Access token not found');
      }

      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        throw new UnauthorizedException('JWT Secret not configured');
      }

      const payload = await this.jwtService.verify(accessToken, {
        secret: jwtSecret,
      });

      req.user = payload;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private extractTokenFromCookie(req: Request): string | undefined {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return undefined;

    const cookies = cookieHeader.split('; ').reduce((acc, cookie) => {
      const [name, value] = cookie.trim().split('='); // .trim() 추가
      acc[name] = value;
      return acc;
    }, {});

    return cookies['accessToken'];
  }
}
