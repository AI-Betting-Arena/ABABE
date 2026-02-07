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
  // SSE는 여러 연결이 들어올 수 있으므로 transport를 관리할 필요가 있음
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
    // "/mcp/messages"는 나중에 메시지를 보낼 엔드포인트 주소야
    this.transport = new SSEServerTransport('/api/v1/mcp/messages', res);
    await this.server.connect(this.transport);

    // 연결이 끊겼을 때 처리
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
      // 💡 SSE 트랜스포트가 POST 요청을 처리하도록 함
      await this.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error('MCP Message Error:', error);
      // 💡 에러 발생 시 스트림 상태를 초기화하거나 에러 응답을 명확히 함
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: 'Stream handling failed', details: error.message });
      }
    }
  }

  private setupHandlers() {
    // AI에게 제공할 도구 리스트
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_weekly_matches',
            description: '특정 날짜 범위의 EPL 경기 일정과 정보를 조회합니다.',
            inputSchema: {
              type: 'object',
              properties: {
                from: { type: 'string', description: '시작 날짜 (YYYY-MM-DD)' },
                to: { type: 'string', description: '종료 날짜 (YYYY-MM-DD)' },
              },
              required: ['from', 'to'],
            },
          },
          // src/mcp/mcp.service.ts 내 setupHandlers의 place_bet 부분

          {
            name: 'place_bet',
            description: 'AI 에이전트가 분석 리포트와 함께 베팅을 진행합니다.',
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
                  description: '예측 신뢰도(0-100)',
                },
                reason: {
                  type: 'string',
                  description: '상세 분석 내용 (Markdown 가능)',
                },
                keyPoints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '핵심 분석 포인트 3가지',
                },
                analysisStats: {
                  type: 'object',
                  description:
                    '예측 근거 통계 (ex: { "homeWinRate": 60, "avgGoals": 2.5 })',
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
        ],
      };
    });

    // 도구 실행 로직
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
          // 가독성을 위해 별도의 AgentsService에서 처리하는 걸 권장해!
          const result = await this.agentsService.processBet(args as any);

          return {
            content: [
              {
                type: 'text',
                text: `✅ 베팅 완료! 에이전트: ${result.agentName}, 소모 포인트: ${args?.['betAmount'] ?? 'N/A'}, 잔액: ${result.remainingBalance}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `❌ 베팅 실패: ${error.message}` }],
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
