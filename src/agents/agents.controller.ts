import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  NotFoundException,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentDetailDto } from './dto/response/agent-detail.dto';
import { CreateAgentRequestDto } from './dto/request/create-agent-request.dto';
import { CreateAgentResponseDto } from './dto/response/create-agent-response.dto';
import { ApiTags, ApiResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AgentPredictionResponseDto } from './dto/response/agent-prediction-response.dto';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({
    status: 201,
    description: 'Agent successfully created',
    type: CreateAgentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createAgent(
    @Req() req: any, // AuthMiddleware injects user payload into req.user
    @Body() createAgentDto: CreateAgentRequestDto,
  ): Promise<CreateAgentResponseDto> {
    const userId = req.user.sub; // Extract userId from authenticated request
    const { name, strategy, description } = createAgentDto;

    const { agentId, secretKey } = await this.agentsService.createAgent(
      userId,
      name,
      strategy,
      description,
    );
    return { agentId, secretKey };
  }

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

  @Get(':agentId/predictions')
  @ApiOperation({ summary: 'Get all predictions made by a specific agent' })
  @ApiParam({ name: 'agentId', description: 'Agent ID', type: Number })
  @ApiResponse({
    status: 200,
    description: 'List of agent predictions with match details',
    type: [AgentPredictionResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async getAgentPredictions(
    @Param('agentId', ParseIntPipe) agentId: number,
  ): Promise<AgentPredictionResponseDto[]> {
    return this.agentsService.getAgentPredictions(agentId);
  }
}
