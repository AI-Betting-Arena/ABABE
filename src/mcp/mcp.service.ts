import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MatchesService } from '../matches/matches.service';
import { Request, Response } from 'express';
import { AgentsService } from 'src/agents/agents.service';
import { ProcessBetRequestDto } from 'src/agents/dto/request/process-bet-request.dto';
import { ProcessBetResponseDto } from 'src/agents/dto/response/process-bet-response.dto';
import { SettlementService } from 'src/settlement/settlement.service';
import { DateProvider } from 'src/common/providers/date.provider';
import { randomUUID } from 'crypto';

/**
 * [PRINCIPLE: SRP] MCP Service - Per-Connection Server Management
 *
 * Previous issue: Single Server instance caused "Already connected" error
 * when multiple clients attempted SSE connections.
 *
 * Solution: Each SSE connection gets its own Server instance stored in a Map.
 * Server.connect() enforces 1:1 binding between Server and Transport.
 *
 * Why this works: MCP SDK documentation shows Server instances should be
 * created per-request for stateless operation, or Transport should be reused
 * for stateful sessions. SSE creates new Transport per connection, so we
 * create new Server per connection.
 */
@Injectable()
export class McpService implements OnModuleDestroy {
  /**
   * Map of active connections: connectionId -> { server, transport }
   * Each SSE connection maintains its own Server instance to avoid
   * "Already connected to a transport" errors.
   */
  private readonly connections = new Map<
    string,
    { server: Server; transport: SSEServerTransport }
  >();

  constructor(
    private readonly matchesService: MatchesService,
    private readonly agentsService: AgentsService,
    private readonly settlementService: SettlementService,
    private readonly dateProvider: DateProvider,
  ) {
    // No longer creating a single shared Server instance
    // Each connection will create its own via createServerInstance()
  }

  /**
   * [PRINCIPLE: SRP] Handle SSE connection - creates isolated Server per client
   *
   * Each SSE connection receives:
   * 1. Unique connectionId for tracking
   * 2. Dedicated Server instance (avoids "Already connected" error)
   * 3. SSEServerTransport bound to this Server
   * 4. Cleanup handler on connection close
   */
  async handleSse(req: Request, res: Response): Promise<void> {
    const connectionId = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create a new Server instance for this connection
    const server = this.createServerInstance();
    const transport = new SSEServerTransport('/api/v1/mcp/messages', res);

    // Connect Server to Transport (1:1 binding)
    await server.connect(transport);

    // Store connection for tracking and cleanup
    this.connections.set(connectionId, { server, transport });
    console.log(
      `MCP SSE connection established: ${connectionId} (total: ${this.connections.size})`,
    );

    // Cleanup on client disconnect
    req.on('close', async () => {
      console.log(`MCP SSE connection closed: ${connectionId}`);
      const connection = this.connections.get(connectionId);

      if (connection) {
        try {
          // Close Server (also closes Transport)
          await connection.server.close();
        } catch (error) {
          console.error(
            `Error closing connection ${connectionId}:`,
            error.message,
          );
        } finally {
          // Always remove from map
          this.connections.delete(connectionId);
          console.log(
            `MCP connection cleaned up: ${connectionId} (remaining: ${this.connections.size})`,
          );
        }
      }
    });
  }

  /**
   * Handle POST /messages endpoint
   *
   * Routes message to the first active SSE connection's transport.
   * In typical usage, there's one active SSE connection per client session.
   */
  async handleMessage(req: Request, res: Response): Promise<void> {
    // Get the first active connection
    const connection = Array.from(this.connections.values())[0];

    if (connection?.transport) {
      await connection.transport.handlePostMessage(req, res);
    } else {
      res.status(503).json({
        error: 'No active MCP connection. Please establish SSE connection first.',
      });
    }
  }

  /**
   * Cleanup all active connections on module shutdown
   */
  async onModuleDestroy() {
    console.log(
      `McpService shutting down: closing ${this.connections.size} active connections`,
    );

    const closePromises = Array.from(this.connections.entries()).map(
      async ([connectionId, connection]) => {
        try {
          await connection.server.close();
          console.log(`Closed connection: ${connectionId}`);
        } catch (error) {
          console.error(
            `Error closing connection ${connectionId}:`,
            error.message,
          );
        }
      },
    );

    await Promise.all(closePromises);
    this.connections.clear();
    console.log('McpService shutdown complete');
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
   * [PRINCIPLE: DRY] Create a new Server instance with all tool handlers
   *
   * Each connection needs its own Server instance, but they all share
   * the same tool definitions. This method centralizes Server creation
   * to avoid code duplication.
   */
  private createServerInstance(): Server {
    const server = new Server(
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
   * Setup tool handlers for a Server instance
   *
   * @param server - The Server instance to configure
   */
  private setupToolHandlers(server: Server) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
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
                  description: 'A date within the desired week (YYYY-MM-DD, UTC)',
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

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
