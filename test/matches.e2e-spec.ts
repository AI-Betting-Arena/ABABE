import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { Match, Agent, Prediction, User, League, Season, Team } from '@prisma/client';

describe('MatchesController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  let testUser: User;
  let testAgent: Agent;
  let testLeague: League;
  let testSeason: Season;
  let testHomeTeam: Team;
  let testAwayTeam: Team;
  let testMatch: Match;
  let testPrediction: Prediction;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Clean up database before each test
    await prismaService.prediction.deleteMany({});
    await prismaService.match.deleteMany({});
    await prismaService.agent.deleteMany({});
    await prismaService.user.deleteMany({});
    await prismaService.season.deleteMany({});
    await prismaService.team.deleteMany({});
    await prismaService.league.deleteMany({});


    // Seed test data
    testUser = await prismaService.user.create({
      data: {
        provider: 'test_provider',
        socialId: 'test_social_id',
        username: 'test_user',
        email: 'test@example.com',
      },
    });

    testAgent = await prismaService.agent.create({
      data: {
        agentId: 'agent_test_id_1',
        secretKey: 'secret_test_key_1',
        name: 'Test Agent 1',
        badge: 'Expert',
        strategy: 'Data-driven strategy',
        userId: testUser.id,
      },
    });

    testLeague = await prismaService.league.create({
      data: {
        apiId: 2021,
        name: 'Test League',
        code: 'TL',
      },
    });

    testSeason = await prismaService.season.create({
      data: {
        apiId: 1234,
        leagueId: testLeague.id,
        startDate: new Date('2025-08-01T00:00:00Z'),
        endDate: new Date('2026-05-31T23:59:59Z'),
      },
    });

    testHomeTeam = await prismaService.team.create({
      data: {
        apiId: 1,
        name: 'Test Home Team',
      },
    });

    testAwayTeam = await prismaService.team.create({
      data: {
        apiId: 2,
        name: 'Test Away Team',
      },
    });

    testMatch = await prismaService.match.create({
      data: {
        apiId: 1000,
        seasonId: testSeason.id,
        utcDate: new Date('2026-02-08T15:00:00Z'),
        status: 'FINISHED',
        matchday: 1,
        homeTeamId: testHomeTeam.id,
        awayTeamId: testAwayTeam.id,
        winner: 'HOME_TEAM',
        homeScore: 2,
        awayScore: 1,
      },
    });

    testPrediction = await prismaService.prediction.create({
      data: {
        agentId: testAgent.id,
        matchId: testMatch.id,
        betAmount: 100,
        prediction: 'HOME_TEAM',
        confidence: 80,
        summary: 'Test prediction summary.',
        keyPoints: ['Key Point 1', 'Key Point 2'],
        analysisStats: { homeWinRate: 0.7, avgGoals: 2.5 },
        status: 'PENDING',
        content: 'Detailed analysis content for the test prediction.', // Added missing content
      },
    });
  });

  afterEach(async () => {
    await prismaService.prediction.deleteMany({});
    await prismaService.match.deleteMany({});
    await prismaService.agent.deleteMany({});
    await prismaService.user.deleteMany({});
    await prismaService.season.deleteMany({});
    await prismaService.team.deleteMany({});
    await prismaService.league.deleteMany({});
    await app.close();
  });

  it('GET /matches/:id/predictions should return an array of predictions for a given match', async () => {
    const response = await request(app.getHttpServer())
      .get(`/matches/${testMatch.id}/predictions`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(1);

    const prediction = response.body[0];
    expect(prediction).toHaveProperty('id', testPrediction.id);
    expect(prediction).toHaveProperty('prediction', testPrediction.prediction);
    expect(prediction).toHaveProperty('confidence', testPrediction.confidence);
    expect(prediction).toHaveProperty('betAmount', testPrediction.betAmount.toNumber());
    expect(prediction).toHaveProperty('summary', testPrediction.summary);
    expect(prediction).toHaveProperty('keyPoints');
    expect(prediction.keyPoints).toEqual(testPrediction.keyPoints);
    expect(prediction).toHaveProperty('analysisStats');
    expect(prediction.analysisStats).toEqual(testPrediction.analysisStats);
    expect(prediction).toHaveProperty('status', testPrediction.status);
    expect(prediction).toHaveProperty('createdAt');

    expect(prediction).toHaveProperty('agent');
    expect(prediction.agent).toHaveProperty('id', testAgent.id);
    expect(prediction.agent).toHaveProperty('name', testAgent.name);
    expect(prediction.agent).toHaveProperty('badge', testAgent.badge);
    expect(prediction.agent).toHaveProperty('strategy', testAgent.strategy);
  });

  it('GET /matches/:id/predictions should return an empty array if no predictions found for the match', async () => {
    // Create a match without any predictions
    const matchWithoutPredictions = await prismaService.match.create({
      data: {
        apiId: 1001,
        seasonId: testSeason.id,
        utcDate: new Date('2026-02-09T15:00:00Z'),
        status: 'SCHEDULED',
        matchday: 2,
        homeTeamId: testHomeTeam.id,
        awayTeamId: testAwayTeam.id,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/matches/${matchWithoutPredictions.id}/predictions`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBe(0);
  });
});
