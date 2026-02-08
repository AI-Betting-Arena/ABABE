import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// .env 파일 로드
dotenv.config();

// 1. pg Pool 생성
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. 어댑터 적용해서 PrismaClient 인스턴스화
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 14423 }, // 추가
    update: {},
    create: {
      id: 14423,
      provider: '',
      socialId: '',
      username: 'Lee',
      email: 'test1@example.com',
      password: 'test123',
      avatarUrl: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Agent 생성
  const agent = await prisma.agent.upsert({
    where: { id: 14425 }, // 추가
    update: {},
    create: {
      id: 14425,
      agentId: 'agent_001',
      secretKey: 'sk_ababe_test_123',
      name: "Lee's Agent",
      balance: 1000,
      userId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  // 1. 리그 생성
  const league = await prisma.league.upsert({
    where: { apiId: 2021 },
    update: {},
    create: {
      apiId: 2021,
      name: 'Premier League',
      code: 'PL',
      type: 'LEAGUE',
      emblem: 'https://crests.football-data.org/PL.png',
      areaName: 'England',
      areaCode: 'ENG',
    },
  });

  // 2. 시즌 생성
  const season = await prisma.season.upsert({
    where: { apiId: 2403 },
    update: {},
    create: {
      apiId: 2403,
      leagueId: league.id,
      startDate: new Date('2025-08-15'),
      endDate: new Date('2026-05-24'),
    },
  });

  // 3. 팀 데이터 (필요한 팀들 전부 추가)
  const teamsData = [
    {
      apiId: 73,
      name: 'Tottenham Hotspur FC',
      shortName: 'Tottenham',
      tla: 'TOT',
      crest: 'https://crests.football-data.org/73.png',
    },
    {
      apiId: 67,
      name: 'Newcastle United FC',
      shortName: 'Newcastle',
      tla: 'NEW',
      crest: 'https://crests.football-data.org/67.png',
    },
    {
      apiId: 61,
      name: 'Chelsea FC',
      shortName: 'Chelsea',
      tla: 'CHE',
      crest: 'https://crests.football-data.org/61.png',
    },
    {
      apiId: 341,
      name: 'Leeds United FC',
      shortName: 'Leeds United',
      tla: 'LEE',
      crest: 'https://crests.football-data.org/341.png',
    },
    {
      apiId: 65,
      name: 'Manchester City FC',
      shortName: 'Man City',
      tla: 'MCI',
      crest: 'https://crests.football-data.org/65.png',
    },
    {
      apiId: 57,
      name: 'Arsenal FC',
      shortName: 'Arsenal',
      tla: 'ARS',
      crest: 'https://crests.football-data.org/57.png',
    },
    {
      apiId: 66,
      name: 'Manchester United FC',
      shortName: 'Man United',
      tla: 'MUN',
      crest: 'https://crests.football-data.org/66.png',
    },
    {
      apiId: 64,
      name: 'Liverpool FC',
      shortName: 'Liverpool',
      tla: 'LIV',
      crest: 'https://crests.football-data.org/64.png',
    },
    {
      apiId: 62,
      name: 'Everton FC',
      shortName: 'Everton',
      tla: 'EVE',
      crest: 'https://crests.football-data.org/62.png',
    },
    {
      apiId: 1044,
      name: 'AFC Bournemouth',
      shortName: 'Bournemouth',
      tla: 'BOU',
      crest: 'https://crests.football-data.org/bournemouth.png',
    },
    {
      apiId: 563,
      name: 'West Ham United FC',
      shortName: 'West Ham',
      tla: 'WHU',
      crest: 'https://crests.football-data.org/563.png',
    },
    {
      apiId: 63,
      name: 'Fulham FC',
      shortName: 'Fulham',
      tla: 'FUL',
      crest: 'https://crests.football-data.org/63.png',
    },
    {
      apiId: 354,
      name: 'Crystal Palace FC',
      shortName: 'Crystal Palace',
      tla: 'CRY',
      crest: 'https://crests.football-data.org/354.png',
    },
    {
      apiId: 328,
      name: 'Burnley FC',
      shortName: 'Burnley',
      tla: 'BUR',
      crest: 'https://crests.football-data.org/328.png',
    },
    {
      apiId: 58,
      name: 'Aston Villa FC',
      shortName: 'Aston Villa',
      tla: 'AVL',
      crest: 'https://crests.football-data.org/58.png',
    },
    {
      apiId: 397,
      name: 'Brighton & Hove Albion FC',
      shortName: 'Brighton Hove',
      tla: 'BHA',
      crest: 'https://crests.football-data.org/397.png',
    },
    {
      apiId: 351,
      name: 'Nottingham Forest FC',
      shortName: 'Nottingham',
      tla: 'NOT',
      crest: 'https://crests.football-data.org/351.png',
    },
    {
      apiId: 76,
      name: 'Wolverhampton Wanderers FC',
      shortName: 'Wolverhampton',
      tla: 'WOL',
      crest: 'https://crests.football-data.org/76.png',
    },
    {
      apiId: 71,
      name: 'Sunderland AFC',
      shortName: 'Sunderland',
      tla: 'SUN',
      crest: 'https://crests.football-data.org/71.png',
    },
    {
      apiId: 402,
      name: 'Brentford FC',
      shortName: 'Brentford',
      tla: 'BRE',
      crest: 'https://crests.football-data.org/402.png',
    },
  ];

  // 팀 정보 먼저 DB에 넣고 맵핑 정보 보관
  const teamApiIdToInternalId: Record<number, number> = {};

  for (const teamData of teamsData) {
    const team = await prisma.team.upsert({
      where: { apiId: teamData.apiId },
      update: {},
      create: teamData,
    });
    teamApiIdToInternalId[teamData.apiId] = team.id;

    // SeasonTeam 연결
    await prisma.seasonTeam.upsert({
      where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
      update: {},
      create: { seasonId: season.id, teamId: team.id },
    });
  }

  // 4. 경기 데이터
  const matchesData = [
    {
      apiId: 538043,
      date: '2026-02-10T19:30:00Z',
      homeId: 73,
      awayId: 67,
      day: 26,
    },
    {
      apiId: 538039,
      date: '2026-02-10T19:30:00Z',
      homeId: 61,
      awayId: 341,
      day: 26,
    },
    {
      apiId: 538040,
      date: '2026-02-10T19:30:00Z',
      homeId: 62,
      awayId: 1044,
      day: 26,
    },
    {
      apiId: 538044,
      date: '2026-02-10T20:15:00Z',
      homeId: 563,
      awayId: 66,
      day: 26,
    },
    {
      apiId: 538041,
      date: '2026-02-11T19:30:00Z',
      homeId: 65,
      awayId: 63,
      day: 26,
    },
    {
      apiId: 538037,
      date: '2026-02-11T19:30:00Z',
      homeId: 354,
      awayId: 328,
      day: 26,
    },
    {
      apiId: 538036,
      date: '2026-02-11T19:30:00Z',
      homeId: 58,
      awayId: 397,
      day: 26,
    },
    {
      apiId: 538042,
      date: '2026-02-11T19:30:00Z',
      homeId: 351,
      awayId: 76,
      day: 26,
    },
    {
      apiId: 538035,
      date: '2026-02-11T20:15:00Z',
      homeId: 71,
      awayId: 64,
      day: 26,
    },
    {
      apiId: 538038,
      date: '2026-02-12T20:00:00Z',
      homeId: 402,
      awayId: 57,
      day: 26,
    },
  ];

  for (const match of matchesData) {
    await prisma.match.upsert({
      where: { apiId: match.apiId },
      update: {
        utcDate: new Date(match.date),
      },
      create: {
        apiId: match.apiId,
        seasonId: season.id,
        utcDate: new Date(match.date),
        status: 'TIMED',
        matchday: match.day,
        // 💡 connect 대신 조회한 실제 id를 직접 할당하는 방식 (타입 에러 회피)
        homeTeamId: teamApiIdToInternalId[match.homeId],
        awayTeamId: teamApiIdToInternalId[match.awayId],
      },
    });
  }

  console.log('✅ Seed data inserted successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
