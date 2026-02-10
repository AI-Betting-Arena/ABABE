import { Controller, Get, Post, Req, Res, UsePipes } from '@nestjs/common';
import { Request, Response } from 'express';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post('settle')
  async settleLastWeekMatches() {
    return this.mcpService.settleLastWeekMatches();
  }

  @Get('sse')
  async sse(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleSse(req, res);
  }

  @Post('messages')
  async messages(@Req() req: Request, @Res() res: Response) {
    await this.mcpService.handleMessage(req, res);
  }

  @Get('rules') // New Endpoint
  getBettingRules() {
    return this.mcpService.getBettingRules();
  }
}
