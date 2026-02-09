import { PrismaClient, Prisma } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { MatchStatus } from '../src/common/constants/match-status.enum'; // Added import

// .env 파일 로드
dotenv.config();

// --- Principle: Fail-fast. 환경 변수 존재 여부 확인 ---
if (!process.env.FOOTBALL_DATA_API_TOKEN) {
  throw new Error(
    'FATAL: FOOTBALL_DATA_API_TOKEN is not defined in the .env file.',
  );
}

// 1. pg Pool 생성
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. 어댑터 적용해서 PrismaClient 인스턴스화
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const API_TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;
const API_BASE_URL = 'https://api.football-data.org/v4';
const PREMIER_LEAGUE_ID = 2021;

interface MatchApiResponse {
  matches: any[];
}

/**
 * --- Principle: SRP (Single Responsibility Principle) ---
 * 이 함수는 오직 API로부터 경기 데이터를 가져오는 책임만 가짐.
 * 모킹이 용이해져 테스트하기 좋은 구조가 됨.
 */
async function fetchMatchesFromApi(dateFrom: string, dateTo: string) {
  try {
    const response = await axios.get<MatchApiResponse>(
      `${API_BASE_URL}/matches?competitions=${PREMIER_LEAGUE_ID}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: { 'X-Auth-Token': API_TOKEN },
      },
    );
    return response.data.matches;
  } catch (error) {
    console.error(
      `Error fetching matches from ${dateFrom} to ${dateTo}:`,
      error.response?.data || error.message,
    );
    return []; // 에러 발생 시 빈 배열 반환하여 다음 작업에 영향 최소화
  }
}

/**
 * --- Principle: SRP ---
 * 이 함수는 현재 주의 경기 상태를 업데이트하는 책임만 가짐.
 */
async function updateCurrentWeekMatches(prisma: PrismaClient) {
  // 시뮬레이션 기준일: 2026년 2월 9일 월요일
  const today = new Date('2026-02-09T00:00:00Z');
  const dayOfWeek = today.getUTCDay(); // 0(일) ~ 6(토)

  // 이번 주 월요일 (UTC 00:00:00)
  const startDate = new Date(today);
  startDate.setUTCDate(today.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  // 이번 주 일요일 (UTC 23:59:59)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);

  console.log(
    `Updating matches from ${startDate.toISOString()} to ${endDate.toISOString()} to ${MatchStatus.BETTING_OPEN}...`,
  );

  const result = await prisma.match.updateMany({
    where: {
      utcDate: {
        gte: startDate,
        lte: endDate,
      },
      status: MatchStatus.UPCOMING, // Changed from 'TIMED'
    },
    data: {
      status: MatchStatus.BETTING_OPEN, // Changed from 'BETTING_OPEN' string
    },
  });

  console.log(`✅ ${result.count} matches updated to ${MatchStatus.BETTING_OPEN}.`);
}


// Renamed from seedFutureMatches to seedMatches to reflect it seeds all relevant weeks
async function seedMatches(
  prisma: PrismaClient,
  teamMap: Record<number, number>,
  seasonId: number,
) {
  const WEEKS_TO_FETCH = 10;
  // API Rate Limit(분당 10회) 준수를 위한 딜레이 (6초)
  const API_DELAY_MS = 6000;

  console.log(`Fetching next ${WEEKS_TO_FETCH} weeks of matches...`);
  
  const today = new Date('2026-02-09T00:00:00Z'); // Simulation date

  // Loop from 0 to WEEKS_TO_FETCH - 1 to include the current week
  for (let i = 0; i < WEEKS_TO_FETCH; i++) {
    const dateFrom = new Date(today);
    const dayOfWeek = dateFrom.getUTCDay(); // 0(일) ~ 6(토)

    // i 주 후의 월요일 계산 (i=0일 때 오늘이 속한 주간의 월요일이 됨)
    dateFrom.setUTCDate(dateFrom.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (i * 7));
    dateFrom.setUTCHours(0, 0, 0, 0);

    const dateTo = new Date(dateFrom);
    dateTo.setUTCDate(dateFrom.getUTCDate() + 6);
    dateTo.setUTCHours(23, 59, 59, 999);

    const dateFromString = dateFrom.toISOString().split('T')[0];
    const dateToString = dateTo.toISOString().split('T')[0];

    console.log(`\n[Week ${i}] Fetching from ${dateFromString} to ${dateToString}...`);

    const matches = await fetchMatchesFromApi(dateFromString, dateToString);

    if (!matches || matches.length === 0) {
      console.log(`No matches found for week ${i}.`);
      continue;
    }

    for (const match of matches) {
      const homeTeamId = teamMap[match.homeTeam.id];
      const awayTeamId = teamMap[match.awayTeam.id];

      // 팀 정보가 DB에 없는 경우 건너뛰기
      if (!homeTeamId || !awayTeamId) {
        console.warn(
          `Skipping match ID ${match.id}: Team not found in DB (Home: ${match.homeTeam.id}, Away: ${match.awayTeam.id})`,
        );
        continue;
      }

      await prisma.match.upsert({
        where: { apiId: match.id },
        create: {
          apiId: match.id,
          seasonId: seasonId,
          utcDate: new Date(match.utcDate),
          status: MatchStatus.UPCOMING,
          matchday: match.matchday,
          homeTeamId: homeTeamId,
          awayTeamId: awayTeamId,
          stage: match.stage,
          poolHome: new Prisma.Decimal(0),
          poolDraw: new Prisma.Decimal(0),
          poolAway: new Prisma.Decimal(0),
          oddsHome: new Prisma.Decimal(2.52),
          oddsDraw: new Prisma.Decimal(3.15),
          oddsAway: new Prisma.Decimal(2.52),
        },
        update: {
          utcDate: new Date(match.utcDate),
          matchday: match.matchday,
          poolHome: new Prisma.Decimal(0),
          poolDraw: new Prisma.Decimal(0),
          poolAway: new Prisma.Decimal(0),
          oddsHome: new Prisma.Decimal(2.52),
          oddsDraw: new Prisma.Decimal(3.15),
          oddsAway: new Prisma.Decimal(2.52),
        },
      });
    }
    console.log(`   -> ${matches.length} matches upserted for week ${i}.`);

    // --- Principle: API Rate Limiting 준수 ---
    if (i < WEEKS_TO_FETCH) {
      console.log(`   Waiting ${API_DELAY_MS / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
    }
  }
}

async function main() {
  console.log('🚀 Starting seed script...');
  // --- 기존의 유저, 에이전트, 리그, 시즌, 팀 시딩 로직은 유지 ---
  const user = await prisma.user.upsert({
    where: {
      socialId_provider: { socialId: 'admin_test', provider: 'LOCAL' },
    },
    update: {},
    create: {
      provider: 'LOCAL',
      socialId: 'admin_test',
      username: 'Lee',
      email: 'admin_test@example.com',
      password: 'test123',
      avatarUrl: '',
    },
  });

  await prisma.agent.upsert({
    where: { agentId: 'agent_001' },
    update: {},
    create: {
      agentId: 'agent_001',
      secretKey: 'sk_ababe_test_123',
      name: "Lee's Agent",
      balance: 1000,
      userId: user.id,
    },
  });

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

  const teamApiIdToInternalId: Record<number, number> = {};
  console.log('Seeding teams...');
  for (const teamData of teamsData) {
    const team = await prisma.team.upsert({
      where: { apiId: teamData.apiId },
      update: {},
      create: teamData,
    });
    teamApiIdToInternalId[teamData.apiId] = team.id;

    await prisma.seasonTeam.upsert({
      where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
      update: {},
      create: { seasonId: season.id, teamId: team.id },
    });
  }
  console.log('✅ Teams seeded.');

  // --- [REMOVED] 하드코딩된 경기 데이터 및 관련 루프 제거 ---

  // --- [ADDED] 분리된 함수들을 순서대로 호출 ---
  await seedMatches(prisma, teamApiIdToInternalId, season.id); // Call seedMatches first
  await updateCurrentWeekMatches(prisma); // Then call updateCurrentWeekMatches

  console.log('\n✅ Seed data script finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ An error occurred during the seed script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
