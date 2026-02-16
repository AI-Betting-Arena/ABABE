import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MatchesService } from '../matches/matches.service';
import { Request, Response } from 'express';
import { AgentsService } from 'src/agents/agents.service';
import { ProcessBetRequestDto } from 'src/agents/dto/request/process-bet-request.dto';
import { ProcessBetResponseDto } from 'src/agents/dto/response/process-bet-response.dto';
import { UpdateBetRequestDto } from 'src/agents/dto/request/update-bet-request.dto';
import { SettlementService } from 'src/settlement/settlement.service';
import { DateProvider } from 'src/common/providers/date.provider';
import { randomUUID } from 'crypto';

/**
 * [PRINCIPLE: SRP] MCP Service - Stateless Streamable HTTP Transport
 *
 * Migrated from deprecated SSE transport to official Streamable HTTP transport.
 * Each request creates its own McpServer instance for stateless operation.
 * No session tracking needed - each request is independent.
 */
@Injectable()
export class McpService {

  constructor(
    private readonly matchesService: MatchesService,
    private readonly agentsService: AgentsService,
    private readonly settlementService: SettlementService,
    private readonly dateProvider: DateProvider,
  ) {
    // Stateless service - no initialization needed
  }

  /**
   * Handle Streamable HTTP MCP request
   * Creates stateless McpServer instance per request
   */
  async handleMcp(req: Request, res: Response): Promise<void> {
    const connectionId = randomUUID(); // For logging only

    console.log(`[MCP ${connectionId}] Request from ${req.ip}`);
    console.log(`[MCP ${connectionId}] User-Agent: ${req.headers['user-agent']}`);

    try {
      // Create fresh server instance (stateless)
      const server = this.createServerInstance();

      // Create transport in stateless mode
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      // Connect and handle request
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);

      console.log(`[MCP ${connectionId}] Request handled successfully`);
    } catch (error) {
      console.error(`[MCP ${connectionId}] Error:`, error.message);
      console.error(`[MCP ${connectionId}] Stack:`, error.stack);

      if (!res.headersSent) {
        res.status(500).json({
          error: 'MCP request failed',
          details: error.message,
          connectionId,
        });
      }
    }
  }

  settleLastWeekMatches(): Promise<string> {
    this.settlementService.handleWeeklySettlement();
    return Promise.resolve(
      'Weekly settlement process has been manually triggered and is running in the background.',
    );
  }

  getBettingRules() {
    // Return a simplified version of rules for brevity
    return {
      arenaName: 'AI Betting Arena (ABA)',
      version: '1.0',
    };
  }

  /**
   * [PRINCIPLE: DRY] Create a new McpServer instance with all tool handlers
   *
   * Each request needs its own McpServer instance for stateless operation.
   * All instances share the same tool definitions.
   */
  private createServerInstance(): McpServer {
    const server = new McpServer(
      {
        name: 'ababe-arena-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers(server);
    return server;
  }

  /**
   * Setup tool handlers for a McpServer instance
   *
   * @param server - The McpServer instance to configure
   */
  private setupToolHandlers(server: McpServer) {
    server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_weekly_matches',
            description:
              'Retrieves EPL match schedules and information for a specific date range.',
            inputSchema: {
              type: 'object',
              properties: {
                today: {
                  type: 'string',
                  description:
                    'A date within the desired week (YYYY-MM-DD, UTC)',
                },
              },
              required: ['today'],
            },
          },
          {
            name: 'place_bet',
            description:
              'The AI agent places a bet along with an analysis report.',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: { type: 'string' },
                secretKey: { type: 'string' },
                matchId: { type: 'number' },
                prediction: {
                  type: 'string',
                  enum: ['HOME_TEAM', 'AWAY_TEAM', 'DRAW'],
                },
                betAmount: { type: 'number' },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Prediction confidence (0-100)',
                },
                summary: {
                  type: 'string',
                  description:
                    'Concise summary of the analysis (max 100 characters)',
                },
                content: {
                  type: 'string',
                  description: 'Detailed analysis content (Markdown supported)',
                },
                keyPoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Three key analysis points',
                },
                analysisStats: {
                  type: 'object',
                  description:
                    'Prediction basis statistics (e.g., { "homeWinRate": 60, "avgGoals": 2.5 })',
                },
              },
              required: [
                'agentId',
                'secretKey',
                'matchId',
                'prediction',
                'betAmount',
                'confidence',
                'summary',
                'keyPoints',
              ],
            },
          },
          {
            name: 'get_betting_points',
            description:
              'The AI agent inquires about its current betting points.',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: { type: 'string' },
                secretKey: { type: 'string' },
              },
              required: ['agentId', 'secretKey'],
            },
          },
          {
            name: 'update_bet',
            description:
              'Updates an existing bet placed by the AI agent. Allows modifying prediction, bet amount, confidence, summary, content, key points, and analysis stats before the match betting window closes.',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: { type: 'string' },
                secretKey: { type: 'string' },
                matchId: { type: 'number' },
                prediction: {
                  type: 'string',
                  enum: ['HOME_TEAM', 'AWAY_TEAM', 'DRAW'],
                },
                betAmount: { type: 'number' },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Prediction confidence (0-100)',
                },
                summary: {
                  type: 'string',
                  description:
                    'Concise summary of the analysis (max 100 characters)',
                },
                content: {
                  type: 'string',
                  description: 'Detailed analysis content (Markdown supported)',
                },
                keyPoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Three key analysis points',
                },
                analysisStats: {
                  type: 'object',
                  description:
                    'Prediction basis statistics (e.g., { "homeWinRate": 60, "avgGoals": 2.5 })',
                },
              },
              required: ['agentId', 'secretKey', 'matchId'],
            },
          },
          {
            name: 'get_betting_rules',
            description:
              'Retrieves the official rules of the ABABE Arena, including betting limits, fees, and settlement methods.',
            inputSchema: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ],
      };
    });

    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'get_weekly_matches') {
        const { today } = args as { today: string };
        const { startOfWeek, endOfWeek } =
          this.dateProvider.getStartAndEndOfWeekUTC(today);

        const fromString = startOfWeek.toISOString().split('T')[0];
        const toString = endOfWeek.toISOString().split('T')[0];

        const result = await this.matchesService.findMatches(
          fromString,
          toString,
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      if (name === 'place_bet') {
        try {
          const result: ProcessBetResponseDto =
            await this.agentsService.processBet(
              args as unknown as ProcessBetRequestDto,
            );

          return {
            content: [
              {
                type: 'text',
                text: `✅ Betting complete! Agent: ${result.agentName}, Bet Type: ${result.predictionType}, Points spent: ${result.betAmount}, Odds: ${result.betOdd}, Remaining balance: ${result.remainingBalance}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `❌ Betting failed: ${error.message}` },
            ],
            isError: true,
          };
        }
      }

      if (name === 'get_betting_points') {
        try {
          const { agentId, secretKey } = args as {
            agentId: string;
            secretKey: string;
          };
          const balance = await this.agentsService.getAgentBalance(
            agentId,
            secretKey,
          );
          return {
            content: [
              {
                type: 'text',
                text: `✅ Current available betting points: ${balance}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Failed to retrieve betting points: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      if (name === 'update_bet') {
        try {
          const result: ProcessBetResponseDto =
            await this.agentsService.updateBet(
              args as unknown as UpdateBetRequestDto,
            );

          return {
            content: [
              {
                type: 'text',
                text: `✅ Bet updated successfully! Agent: ${result.agentName}, Bet Type: ${result.predictionType}, Points spent: ${result.betAmount}, Odds: ${result.betOdd}, Remaining balance: ${result.remainingBalance}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              { type: 'text', text: `❌ Bet update failed: ${error.message}` },
            ],
            isError: true,
          };
        }
      }

      if (name === 'get_betting_rules') {
        const rules = this.getBettingRules();
        return {
          content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }
}
