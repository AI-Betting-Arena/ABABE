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
import { ProcessBetRequestDto } from 'src/agents/dto/request/process-bet-request.dto'; // Import ProcessBetRequestDto
import { ProcessBetResponseDto } from 'src/agents/dto/response/process-bet-response.dto'; // Import ProcessBetResponseDto
import { SettlementService } from 'src/settlement/settlement.service';
import { DateProvider } from 'src/common/providers/date.provider'; // Import DateProvider

@Injectable()
export class McpService implements OnModuleDestroy {
  private server: Server;
  // SSE can have multiple connections, so it's necessary to manage the transport.
  private transport: SSEServerTransport | null = null;

  constructor(
    private readonly matchesService: MatchesService,
    private readonly agentsService: AgentsService,
    private readonly settlementService: SettlementService,
    private readonly dateProvider: DateProvider, // Inject DateProvider
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

  async settleLastWeekMatches(): Promise<string> {
    // Intentionally not awaiting this to allow the HTTP request to return immediately
    // while the settlement runs in the background.
    this.settlementService.handleWeeklySettlement();
    return 'Weekly settlement process has been manually triggered and is running in the background.';
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

  getBettingRules() {
    return {
      arenaName: 'AI Betting Arena (ABA)',
      version: '1.0',
      riskManagement: {
        maxBetLimitPerMatch: {
          value: 0.2,
          description:
            'You can bet a maximum of 20% of your current points on a single match.',
        },
        minBetAmountPerMatch: {
          value: 1000000,
          description:
            'A minimum of 1,000,000 points is required for each bet.',
        },
        assetProtection:
          'Betting limits are systematically controlled to prevent reckless asset depletion and encourage strategic, long-term participation.',
      },
      economy: {
        initialCapital: {
          value: 10000,
          description: 'All agents start with 10,000 points.',
        },
        payoutSystem: {
          method: 'Pari-mutuel',
          description:
            'The total prize pool, minus a system fee, is distributed among the winners who bet on the correct outcome.',
        },
        systemFee: {
          value: 0.1,
          description:
            'A 10% fee is deducted from the total betting pool to be burned, helping to manage the point economy.',
        },
        payoutFormula:
          '(Total Pool * 0.9) / Total amount bet on the winning outcome (Win/Draw/Loss)',
        winningsCalculation:
          'Winnings are calculated as (Odds at the time of betting * Points bet) and rounded to the nearest whole number.',
      },
      participationProtocol: {
        mandatoryAnalysisReport: {
          requirement:
            'A detailed analysis report in Markdown format must be submitted with every bet.',
          penalty:
            'Bets without a corresponding report will be considered invalid.',
        },
        bettingDeadline:
          'Bets and analysis reports can be submitted or modified up to 10 minutes before the match starts.',
        dataTransparency:
          'All agent analyses and betting records are public and will be used for ranking purposes.',
      },
    };
  }

  private setupHandlers() {
    // List of tools to provide to the AI.
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
          // place_bet section in setupHandlers within src/mcp/mcp.service.ts

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
                'summary', // Changed from 'reason'
                'keyPoints',
              ],
            },
          },
          // Tool to inquire about the AI agent's current betting points.
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
          }, // Added comma here
          // Add the new tool definition
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

    // Tool execution logic.
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'get_weekly_matches') {
        const { today } = args as { today: string };
        const { startOfWeek, endOfWeek } =
          this.dateProvider.getStartAndEndOfWeekUTC(today);

        const fromString = startOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD
        const toString = endOfWeek.toISOString().split('T')[0]; // YYYY-MM-DD

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

      // Add handler for the new tool
      if (name === 'get_betting_rules') {
        const rules = this.getBettingRules();
        return {
          content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    });
  }

  async onModuleDestroy() {
    await this.server.close();
  }
}
