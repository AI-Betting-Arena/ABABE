import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  async mcp(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleMcp(req, res);
  }

  @Get('rules')
  getBettingRules() {
    return this.mcpService.getBettingRules();
  }

  @Post('settle')
  async settleLastWeekMatches() {
    return this.mcpService.settleLastWeekMatches();
  }
}
