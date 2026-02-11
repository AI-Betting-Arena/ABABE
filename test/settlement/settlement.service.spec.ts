
import { Test, TestingModule } from '@nestjs/testing';

import { SettlementService } from '../../src/settlement/settlement.service';

import { PrismaService } from '../../src/prisma.service';

import { HttpService } from '@nestjs/axios';

import { ConfigService } from '@nestjs/config';

import { Logger } from '@nestjs/common';

import { MatchStatus } from '../../src/common/constants/match-status.enum';

import { of, throwError } from 'rxjs'; // Import throwError

import { Match, Prisma } from '../../src/generated/prisma/client';

jest.setTimeout(30000); // Further increase timeout for this test suite

describe('SettlementService', () => {

  let service: SettlementService;

  let prisma: PrismaService;

  let httpService: HttpService;

  let configService: ConfigService;



  const mockPrismaService = {

    match: {

      findMany: jest.fn(),

      update: jest.fn(),

    },

    prediction: {

      findMany: jest.fn(),

      update: jest.fn(),

    },

    agent: {

      update: jest.fn(),

    },

    $transaction: jest.fn((cb) => cb(mockPrismaService)), // Mock transaction to call callback immediately with mockPrismaService

  };



  const mockHttpService = {

    get: jest.fn(() => of({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} })),

  };



  const mockConfigService = {

    get: jest.fn((key: string) => {

      if (key === 'FOOTBALL_DATA_API_TOKEN') return 'test-token';

      return undefined;

    }),

  };



  beforeEach(async () => {

    jest.useFakeTimers();

    // Simulate a Tuesday in UTC for consistent date calculations

    jest.setSystemTime(new Date('2026-02-10T05:00:00Z')); 



    const module: TestingModule = await Test.createTestingModule({

      providers: [

        SettlementService,

        { provide: PrismaService, useValue: mockPrismaService },

        { provide: HttpService, useValue: mockHttpService },

        { provide: ConfigService, useValue: mockConfigService },

      ],

    }).compile();



    service = module.get<SettlementService>(SettlementService);

    prisma = module.get<PrismaService>(PrismaService);

    httpService = module.get<HttpService>(HttpService);

    configService = module.get<ConfigService>(ConfigService);



    // Spy on the logger to prevent console output during tests

    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});

    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});



    // Reset all mocks before each test

    jest.clearAllMocks();

  });



  afterEach(() => {

    jest.runOnlyPendingTimers();

    jest.useRealTimers();

  });



  it('should be defined', () => {

    expect(service).toBeDefined();

  });



  describe('handleWeeklySettlement', () => {

    it('should calculate the correct previous week date range (Monday to Sunday UTC)', async () => {

      // System time is mocked to 2026-02-10T05:00:00Z (Tuesday)

      // Previous week should be 2026-02-02 (Mon) to 2026-02-08 (Sun)



      const expectedLastMonday = new Date('2026-02-02T00:00:00.000Z');

      const expectedLastSunday = new Date('2026-02-08T23:59:59.999Z');



      mockPrismaService.match.findMany.mockResolvedValueOnce([]); // Prevent actual settlement logic from running



      await service.handleWeeklySettlement();



      expect(mockPrismaService.match.findMany).toHaveBeenCalledWith({

        where: {

          utcDate: {

            gte: expectedLastMonday,

            lte: expectedLastSunday,

          },

        },

      });

      expect(service['logger'].log).toHaveBeenCalledWith(

        expect.stringContaining(`Processing matches from ${expectedLastMonday.toISOString()} to ${expectedLastSunday.toISOString()}`),

      );

    });



    it('should log and return if no matches are found for settlement', async () => {

      mockPrismaService.match.findMany.mockResolvedValueOnce([]);



      await service.handleWeeklySettlement();



      expect(service['logger'].log).toHaveBeenCalledWith('No matches to settle this week.');

      expect(mockPrismaService.match.findMany).toHaveBeenCalledTimes(1);

    });



                    it('should call settleMatch for each found match with rate limiting', async () => {



                      const mockMatches: Partial<Match>[] = [



                        { id: 1, apiId: 101, utcDate: new Date('2026-02-05T15:00:00Z') },



                        { id: 2, apiId: 102, utcDate: new Date('2026-02-06T15:00:00Z') },



                      ];



                      mockPrismaService.match.findMany.mockResolvedValueOnce(mockMatches);



                



                      // Mock settleMatch to prevent its internal logic from interfering with this test



                      const settleMatchSpy = jest.spyOn<any>(service, 'settleMatch').mockResolvedValue(undefined);



                



                      const promise = service.handleWeeklySettlement(); // Start the async process



                



                      // Advance timers for each match's delay. There are 2 matches, so 2 delays.



                      jest.advanceTimersByTime(service['API_DELAY_MS']); // After first match



                      await Promise.resolve(); // Drain microtask queue



                      jest.advanceTimersByTime(service['API_DELAY_MS']); // After second match



                      await Promise.resolve(); // Drain microtask queue



                



                      await promise; // Await the completion



                



                      expect(service['logger'].log).toHaveBeenCalledWith('Found 2 matches to settle.');



                      expect(settleMatchSpy).toHaveBeenCalledTimes(2);



                      expect(settleMatchSpy).toHaveBeenCalledWith(mockMatches[0]);



                      expect(settleMatchSpy).toHaveBeenCalledWith(mockMatches[1]);



                    });



                



                    it('should log an error for a failed settlement but continue processing other matches', async () => {



                      const mockMatches: Partial<Match>[] = [



                        { id: 1, apiId: 101, utcDate: new Date('2026-02-05T15:00:00Z') },



                        { id: 2, apiId: 102, utcDate: new Date('2026-02-06T15:00:00Z') },



                      ];



                      mockPrismaService.match.findMany.mockResolvedValueOnce(mockMatches);



                



                      const settleMatchSpy = jest.spyOn<any>(service, 'settleMatch');



                      settleMatchSpy.mockRejectedValueOnce(new Error('API call failed for match 101')); // First match fails



                      settleMatchSpy.mockResolvedValueOnce(undefined); // Second match succeeds



                



                      const promise = service.handleWeeklySettlement(); // Start the async process



                



                      jest.advanceTimersByTime(service['API_DELAY_MS']); // After first match



                      await Promise.resolve(); // Drain microtask queue



                      jest.advanceTimersByTime(service['API_DELAY_MS']); // After second match



                      await Promise.resolve(); // Drain microtask queue



                



                      await promise; // Await the completion



                



                      expect(settleMatchSpy).toHaveBeenCalledTimes(2);



                      expect(service['logger'].error).toHaveBeenCalledWith(



                        expect.stringContaining('Failed to settle match ID: 1 (API ID: 101). Error: API call failed for match 101'),



                      );



                      expect(service['logger'].log).toHaveBeenCalledWith(



                        expect.stringContaining('Successfully settled match ID: 2 (API ID: 102)'),



                      );



                    });



                



            



    

  });



  describe('settleMatch', () => {

    const mockMatch: Match = {

      id: 1,

      apiId: 538015,

      seasonId: 100,

      utcDate: new Date('2026-02-02T20:00:00Z'),

      status: MatchStatus.BETTING_OPEN, // Or any non-SETTLED status

      matchday: 24,

      stage: 'REGULAR_SEASON',

      homeTeamId: 71,

      awayTeamId: 328,

      winner: null,

      homeScore: null,

      awayScore: null,

      poolHome: new Prisma.Decimal(0),

      poolDraw: new Prisma.Decimal(0),

      poolAway: new Prisma.Decimal(0),

      oddsHome: new Prisma.Decimal(2.0),

      oddsDraw: new Prisma.Decimal(3.0),

      oddsAway: new Prisma.Decimal(4.0),

      createdAt: new Date(),

      updatedAt: new Date(),

    };



    const mockExternalApiResponseFinishedHomeWin = {

      id: 538015,

      status: 'FINISHED',

      score: {

        winner: 'HOME_TEAM',

        fullTime: { home: 3, away: 0 },

        halfTime: { home: 2, away: 0 },

      },

    };



    const mockExternalApiResponseFinishedDraw = {

      id: 538015,

      status: 'FINISHED',

      score: {

        winner: 'DRAW',

        fullTime: { home: 1, away: 1 },

        halfTime: { home: 1, away: 0 },

      },

    };



    const mockExternalApiResponsePending = {

      id: 538015,

      status: 'SCHEDULED',

      score: { winner: null, fullTime: { home: 0, away: 0 }, halfTime: { home: 0, away: 0 } },

    };



    const mockPredictionWinHome = {

      id: 1,

      agentId: 1,

      matchId: 1,

      betAmount: new Prisma.Decimal(100),

      betOdd: new Prisma.Decimal(2.0),

      prediction: 'HOME_TEAM',

      status: 'PENDING',

    };



    const mockPredictionLoseAway = {

      id: 2,

      agentId: 2,

      matchId: 1,

      betAmount: new Prisma.Decimal(50),

      betOdd: new Prisma.Decimal(4.0),

      prediction: 'AWAY_TEAM',

      status: 'PENDING',

    };



    const mockPredictionDraw = {

      id: 3,

      agentId: 3,

      matchId: 1,

      betAmount: new Prisma.Decimal(75),

      betOdd: new Prisma.Decimal(3.0),

      prediction: 'DRAW',

      status: 'PENDING',

    };



    it('should fetch match details from external API', async () => {

      mockHttpService.get.mockReturnValueOnce(of({ data: mockExternalApiResponseFinishedHomeWin }));

      mockPrismaService.match.update.mockResolvedValueOnce(mockMatch); // Mock final update

      mockPrismaService.prediction.findMany.mockResolvedValueOnce([]); // No predictions for now



      await service['settleMatch'](mockMatch);



      expect(httpService.get).toHaveBeenCalledWith(

        `https://api.football-data.org/v4/matches/${mockMatch.apiId}`,

        {

          headers: { 'X-Auth-Token': 'test-token' },

        },

      );

    });



    it('should skip settlement if external match status is not FINISHED', async () => {

      mockHttpService.get.mockReturnValueOnce(of({ data: mockExternalApiResponsePending }));



      await service['settleMatch'](mockMatch);



      expect(service['logger'].warn).toHaveBeenCalledWith(`Match ${mockMatch.apiId} is not finished yet. Skipping.`);

      expect(mockPrismaService.prediction.findMany).not.toHaveBeenCalled();

      expect(mockPrismaService.match.update).not.toHaveBeenCalled();

    });



    it('should successfully settle predictions for a home win', async () => {

      mockHttpService.get.mockReturnValueOnce(of({ data: mockExternalApiResponseFinishedHomeWin }));

      mockPrismaService.prediction.findMany.mockResolvedValueOnce([mockPredictionWinHome, mockPredictionLoseAway]);



      // Mock agent balance for increment

      mockPrismaService.agent.update.mockResolvedValueOnce({});

      mockPrismaService.match.update.mockResolvedValueOnce({}); // Mock final match update



      await service['settleMatch'](mockMatch);



      // Verify transaction was called

      expect(mockPrismaService.$transaction).toHaveBeenCalled();



      // Verify winning prediction

      expect(mockPrismaService.prediction.update).toHaveBeenCalledWith({

        where: { id: mockPredictionWinHome.id },

        data: { status: 'SUCCESS' },

      });

      expect(mockPrismaService.agent.update).toHaveBeenCalledWith({

        where: { id: mockPredictionWinHome.agentId },

        data: { balance: { increment: new Prisma.Decimal(200) } }, // 100 * 2.0 = 200

      });



      // Verify losing prediction

      expect(mockPrismaService.prediction.update).toHaveBeenCalledWith({

        where: { id: mockPredictionLoseAway.id },

        data: { status: 'FAIL' },

      });

      expect(mockPrismaService.agent.update).not.toHaveBeenCalledWith({

        where: { id: mockPredictionLoseAway.agentId },

        data: expect.any(Object),

      });



      // Verify match status update

      expect(mockPrismaService.match.update).toHaveBeenCalledWith({

        where: { id: mockMatch.id },

        data: { status: MatchStatus.SETTLED },

      });

      // Removed: expect(service['logger'].log).toHaveBeenCalledWith(`No pending predictions for match ${mockMatch.id}.`);

    });



    it('should successfully settle predictions for a draw', async () => {

      mockHttpService.get.mockReturnValueOnce(of({ data: mockExternalApiResponseFinishedDraw }));

      mockPrismaService.prediction.findMany.mockResolvedValueOnce([mockPredictionDraw, mockPredictionWinHome]);



      // Mock agent balance for increment

      mockPrismaService.agent.update.mockResolvedValueOnce({});

      mockPrismaService.match.update.mockResolvedValueOnce({}); // Mock final match update



      await service['settleMatch'](mockMatch);



      // Verify transaction was called

      expect(mockPrismaService.$transaction).toHaveBeenCalled();



      // Verify winning prediction for DRAW

      expect(mockPrismaService.prediction.update).toHaveBeenCalledWith({

        where: { id: mockPredictionDraw.id },

        data: { status: 'SUCCESS' },

      });

      expect(mockPrismaService.agent.update).toHaveBeenCalledWith({

        where: { id: mockPredictionDraw.agentId },

        data: { balance: { increment: new Prisma.Decimal(225) } }, // 75 * 3.0 = 225

      });



      // Verify losing prediction

      expect(mockPrismaService.prediction.update).toHaveBeenCalledWith({

        where: { id: mockPredictionWinHome.id },

        data: { status: 'FAIL' },

      });

      expect(mockPrismaService.agent.update).not.toHaveBeenCalledWith({

        where: { id: mockPredictionWinHome.agentId },

        data: expect.any(Object),

      });



      // Verify match status update

      expect(mockPrismaService.match.update).toHaveBeenCalledWith({

        where: { id: mockMatch.id },

        data: { status: MatchStatus.SETTLED },

      });

    });



    it('should handle no pending predictions for a match', async () => {

      mockHttpService.get.mockReturnValueOnce(of({ data: mockExternalApiResponseFinishedHomeWin }));

      mockPrismaService.prediction.findMany.mockResolvedValueOnce([]); // No predictions



      await service['settleMatch'](mockMatch);



      expect(service['logger'].log).toHaveBeenCalledWith(`No pending predictions for match ${mockMatch.id}.`);

      expect(mockPrismaService.prediction.update).not.toHaveBeenCalled();

      expect(mockPrismaService.agent.update).not.toHaveBeenCalled();

      expect(mockPrismaService.match.update).toHaveBeenCalledWith({

        where: { id: mockMatch.id },

        data: { status: MatchStatus.SETTLED },

      });

    });



    it('should throw an error if fetching external match data fails', async () => {

      mockHttpService.get.mockReturnValueOnce(throwError(() => new Error('API server down'))); // Simulate API failure



      await expect(service['settleMatch'](mockMatch)).rejects.toThrow(

        `Failed to fetch data for match ${mockMatch.apiId}.`,

      );

      expect(service['logger'].error).toHaveBeenCalledWith(

        `Error fetching match ${mockMatch.apiId} from API: API server down`, // Updated error message check

      );

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled(); // No transaction should start

    });

  });

});
