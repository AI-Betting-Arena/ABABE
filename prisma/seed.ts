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
 * --- Principle: SRP, Efficiency ---
 * 이 함수는 "앞으로 2주간의 경기를 가져와 베팅을 연다"는 단일 책임을 가진다.
 * API 제약을 준수하기 위해 주 단위로 조회하되, DB 접근은 최소화하여 효율을 추구한다.
 */
async function seedAndOpenMatchesForNextTwoWeeks(
  prisma: PrismaClient,
  teamMap: Record<number, number>,
  seasonId: number,
) {
  const allMatches: any[] = [];
  const WEEKS_TO_FETCH = 2;

  // 시뮬레이션 기준일 (실제 운영 시 new Date() 사용)
  const today = new Date('2026-02-09T00:00:00Z');

  // 기준이 될 이번 주 월요일 계산
  const dayOfWeek = today.getUTCDay(); // 0(일) ~ 6(토)
  const baseStartDate = new Date(today);
  baseStartDate.setUTCDate(
    today.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1),
  );
  baseStartDate.setUTCHours(0, 0, 0, 0);

  // 1주씩 2번 루프 돌며 API 호출
  for (let i = 0; i < WEEKS_TO_FETCH; i++) {
    const weekStartDate = new Date(baseStartDate);
    weekStartDate.setUTCDate(baseStartDate.getUTCDate() + i * 7);

    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    // API 조회를 위한 날짜 포맷 (endDate에 하루를 더함)
    const apiEndDate = new Date(weekEndDate);
    apiEndDate.setUTCDate(weekEndDate.getUTCDate() + 1);

    const dateFromString = weekStartDate.toISOString().split('T')[0];
    const dateToString = apiEndDate.toISOString().split('T')[0];

    console.log(
      `\n[Week ${i + 1}/${WEEKS_TO_FETCH}] Fetching from ${dateFromString} to ${dateToString}...`,
    );

    const matches = await fetchMatchesFromApi(dateFromString, dateToString);
    if (matches && matches.length > 0) {
      allMatches.push(...matches);
      console.log(`   -> Found ${matches.length} matches.`);
    } else {
      console.log(`   -> No matches found for this week.`);
    }
  }

  if (allMatches.length === 0) {
    console.log(`\nNo matches found for the next ${WEEKS_TO_FETCH} weeks.`);
    return;
  }

  // --- Upsert 로직 (루프 밖에서 한번에 처리) ---
  console.log(`\nUpserting a total of ${allMatches.length} matches...`);
  for (const match of allMatches) {
    const homeTeamId = teamMap[match.homeTeam.id];
    const awayTeamId = teamMap[match.awayTeam.id];

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
      },
    });
  }
  console.log(`   -> ${allMatches.length} matches upserted.`);

  // --- 2주치 경기를 BETTING_OPEN으로 상태 변경 ---
  const twoWeeksEndDate = new Date(baseStartDate);
  twoWeeksEndDate.setUTCDate(baseStartDate.getUTCDate() + 13);
  twoWeeksEndDate.setUTCHours(23, 59, 59, 999);

  console.log(
    `\nUpdating matches from ${baseStartDate.toISOString()} to ${twoWeeksEndDate.toISOString()} to ${MatchStatus.BETTING_OPEN}...`,
  );

  const result = await prisma.match.updateMany({
    where: {
      utcDate: {
        gte: baseStartDate,
        lte: twoWeeksEndDate,
      },
      status: MatchStatus.UPCOMING,
    },
    data: {
      status: MatchStatus.BETTING_OPEN,
    },
  });

  console.log(`✅ ${result.count} matches updated to ${MatchStatus.BETTING_OPEN}.`);
}

async function main() {
  console.log('🚀 Starting seed script...');


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

  // --- [REPLACED] 기존 함수 호출부를 새 함수 호출로 변경 ---
  await seedAndOpenMatchesForNextTwoWeeks(prisma, teamApiIdToInternalId, season.id);

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
