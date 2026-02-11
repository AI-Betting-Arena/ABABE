// src/agents/my-agents.controller.ts
import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { MyAgentDetailDto } from './dto/response/my-agent-detail.dto';

interface AuthenticatedRequest extends Request {
  user: {
    sub: number; // Assuming sub holds the userId
  };
}

@ApiTags('My Agents') // Swagger tag for this new controller
@Controller('me/agents') // Base path for this controller
export class MyAgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: "Get current user's agents" })
  @ApiResponse({
    status: 200,
    description: 'List of agents for the current user',
    type: [MyAgentDetailDto], // Array of MyAgentDetailDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyAgents(@Req() req: AuthenticatedRequest): Promise<MyAgentDetailDto[]> {
    const userId = req.user.sub; // Extract userId from authenticated request
    return this.agentsService.getMyAgents(userId);
  }
}
