// src/mcp/mcp.service.ts
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

@Injectable()
export class McpService implements OnModuleDestroy {
  private server: Server;
  // SSE can have multiple connections, so it's necessary to manage the transport.
  private transport: SSEServerTransport | null = null;

  constructor(
    private readonly matchesService: MatchesService,
    private readonly agentsService: AgentsService,
  ) {
    this.server = new Server(
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
    this.setupHandlers();
  }

  // 1. SSE 연결 핸들러
  async handleSse(req: Request, res: Response) {
    // "/mcp/messages" is the endpoint address to send messages later.
    this.transport = new SSEServerTransport('/api/v1/mcp/messages', res);
    await this.server.connect(this.transport);

    // Handle when the connection is lost.
    req.on('close', () => {
      this.transport = null;
    });
  }

  // 2. 메시지 수신 핸들러
  // src/mcp/mcp.service.ts

  async handleMessage(req: Request, res: Response) {
    if (!this.transport) {
      res.status(400).send('No SSE connection established');
      return;
    }

    try {
      // 💡 Allow SSE transport to handle POST requests.
      await this.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error('MCP Message Error:', error);
      // 💡 Initialize stream state or clarify error response when an error occurs.
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: 'Stream handling failed', details: error.message });
      }
    }
  }

  private setupHandlers() {
    // List of tools to provide to the AI.
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_weekly_matches',
            description: 'Retrieves EPL match schedules and information for a specific date range.',
            inputSchema: {
              type: 'object',
              properties: {
                from: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
                to: { type: 'string', description: 'End date (YYYY-MM-DD)' },
              },
              required: ['from', 'to'],
            },
          },
          // place_bet section in setupHandlers within src/mcp/mcp.service.ts

          {
            name: 'place_bet',
            description: 'The AI agent places a bet along with an analysis report.',
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
                reason: {
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
                'reason',
                'keyPoints',
              ],
            },
          },
          // Tool to inquire about the AI agent's current betting points.
          {
            name: 'get_betting_points',
            description: 'The AI agent inquires about its current betting points.',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: { type: 'string' },
                secretKey: { type: 'string' },
              },
              required: ['agentId', 'secretKey'],
            },
          },
        ],
      };
    });

    // Tool execution logic.
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'get_weekly_matches') {
        const { from, to } = args as { from: string; to: string };
        const result = await this.matchesService.findMatches(from, to);

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      if (name === 'place_bet') {
        try {
          // It is recommended to handle this in a separate AgentsService for readability.
          const result = await this.agentsService.processBet(args as any);

          return {
            content: [
              {
                type: 'text',
                text: `✅ Betting complete! Agent: ${result.agentName}, Points spent: ${args?.['betAmount'] ?? 'N/A'}, Remaining balance: ${result.remainingBalance}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ Betting failed: ${error.message}` }],
            isError: true,
          };
        }
      }

      if (name === 'get_betting_points') {
        try {
          const { agentId, secretKey } = args as { agentId: string; secretKey: string };
          const balance = await this.agentsService.getAgentBalance(agentId, secretKey);
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
            content: [{ type: 'text', text: `❌ Failed to retrieve betting points: ${error.message}` }],
            isError: true,
          };
        }
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  async onModuleDestroy() {
    await this.server.close();
  }
}
