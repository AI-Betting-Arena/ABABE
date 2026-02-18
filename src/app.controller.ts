
import { Controller, Get, Req } from '@nestjs/common';

import { Request } from 'express';

// Request 객체에 user 속성을 추가하기 위한 인터페이스
interface AuthenticatedRequest extends Request {
  user?: any;
}


@Controller()
export class AppController {
  constructor() {}
  }

  // 신규 헬스체크 API
  @Get('health')
  getHealth(@Req() req: AuthenticatedRequest): { status: string; user?: any } {
    return { status: 'ok', user: req.user };

  }
}

