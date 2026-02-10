// test/matches/matches.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MatchesService } from '../../src/matches/matches.service';
import { PrismaService } from '../../src/prisma.service';
import { MatchStatus } from '../../src/common/constants/match-status.enum';
import { Logger } from '@nestjs/common';

describe('MatchesService', () => {
  let service: MatchesService;
  let prisma: PrismaService;

  // PrismaService 모의 객체
  const mockPrismaService = {
    match: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-10T10:00:00Z')); // 임의의 화요일로 설정

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    // MatchesService 내부에 Logger 인스턴스가 직접 생성되므로, 해당 인스턴스의 메서드를 스파이한다.
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers(); // 테스트 후 실제 타이머로 복원
    jest.clearAllMocks(); // 각 테스트 후 모의 객체 초기화
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateUpcomingMatchesToBettingOpen', () => {
    it('should update UPCOMING matches to BETTING_OPEN for the current week', async () => {
      // 2026-02-10T10:00:00Z (화요일) 기준, 이번 주 월요일 00:00:00 UTC는 2026-02-09T00:00:00Z
      const expectedStartDate = new Date('2026-02-09T00:00:00.000Z');
      const expectedEndDate = new Date('2026-02-15T23:59:59.999Z');

      mockPrismaService.match.updateMany.mockResolvedValueOnce({ count: 5 });

      const updatedCount = await service.updateUpcomingMatchesToBettingOpen();

      expect(updatedCount).toBe(5);
      expect(mockPrismaService.match.updateMany).toHaveBeenCalledWith({
        where: {
          utcDate: {
            gte: expectedStartDate,
            lte: expectedEndDate,
          },
          status: MatchStatus.UPCOMING,
        },
        data: {
          status: MatchStatus.BETTING_OPEN,
        },
      });
      expect(service['logger'].log).toHaveBeenCalledWith(
        `✅ 5 matches updated to BETTING_OPEN for the week ${expectedStartDate.toISOString().split('T')[0]} - ${expectedEndDate.toISOString().split('T')[0]}.`,
      );
    });

    it('should handle no matches being updated', async () => {
      mockPrismaService.match.updateMany.mockResolvedValueOnce({ count: 0 });

      const updatedCount = await service.updateUpcomingMatchesToBettingOpen();
      expect(updatedCount).toBe(0);
      expect(mockPrismaService.match.updateMany).toHaveBeenCalledTimes(1);
      expect(service['logger'].log).toHaveBeenCalledWith(
        expect.stringContaining('✅ 0 matches updated to BETTING_OPEN'),
      );
    });

    it('should throw an error if Prisma update fails', async () => {
      const errorMessage = 'DB connection error';
      mockPrismaService.match.updateMany.mockRejectedValueOnce(new Error(errorMessage));

      await expect(service.updateUpcomingMatchesToBettingOpen()).rejects.toThrow(errorMessage);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `❌ Error updating match statuses: ${errorMessage}`,
        expect.any(String), // stack trace
      );
    });
  });

  describe('handleWeeklyMatchStatusUpdate', () => {
    it('should call updateUpcomingMatchesToBettingOpen and log success', async () => {
      const updateSpy = jest.spyOn(service, 'updateUpcomingMatchesToBettingOpen');
      updateSpy.mockResolvedValueOnce(3);

      await service.handleWeeklyMatchStatusUpdate();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(service['logger'].log).toHaveBeenCalledWith(
        'Starting weekly match status update...',
      );
      expect(service['logger'].log).toHaveBeenCalledWith(
        'Weekly match status update completed. 3 matches updated.',
      );
    });

    it('should log an error if updateUpcomingMatchesToBettingOpen fails', async () => {
      const updateSpy = jest.spyOn(service, 'updateUpcomingMatchesToBettingOpen');
      const error = new Error('Update failed');
      updateSpy.mockRejectedValueOnce(error);

      await service.handleWeeklyMatchStatusUpdate();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(service['logger'].error).toHaveBeenCalledWith(
        `Failed to complete weekly match status update: ${error.message}`,
        error.stack,
      );
    });
  });
});
