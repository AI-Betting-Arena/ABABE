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

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly mcpServer: Server;

  constructor(
    private readonly matchesService: MatchesService,
    private readonly agentsService: AgentsService,
    private readonly settlementService: SettlementService,
    private readonly dateProvider: DateProvider,
  ) {
    this.mcpServer = new Server(
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
    this.setupToolHandlers();
  }

  async handleSse(req: Request, res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const transport = new SSEServerTransport('/api/v1/mcp/messages', res);

    // This will throw "Already connected" on the second connection attempt,
    // as requested by the user for rollback.
    await this.mcpServer.connect(transport);

    req.on('close', () => {
      console.log('A client connection closed.');
      // In this single-server model, we can't easily disconnect a specific transport.
      // Closing the main server would disconnect everyone.
    });
  }

  async handleMessage(req: Request, res: Response): Promise<void> {
    if (this.mcpServer.transport) {
      await (this.mcpServer.transport as SSEServerTransport).handlePostMessage(
        req,
        res,
      );
    } else {
      res.status(503).json({ error: 'Server is not connected to a transport.' });
    }
  }

  async onModuleDestroy() {
    await this.mcpServer.close();
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

  private setupToolHandlers() {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
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

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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
