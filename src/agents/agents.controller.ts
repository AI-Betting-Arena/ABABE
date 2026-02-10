import { Controller, Get, Param, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentDetailDto } from './dto/response/agent-detail.dto';
import { ApiTags, ApiResponse, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Agents')
@Controller('api/v1/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details by ID' })
  @ApiParam({ name: 'id', description: 'Agent ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Agent details successfully retrieved',
    type: AgentDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async getAgentDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AgentDetailDto> {
    const agent = await this.agentsService.getAgentDetails(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }
}
