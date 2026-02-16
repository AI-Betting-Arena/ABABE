import { BadRequestException } from '@nestjs/common';
import { MatchStatus } from '../constants/match-status.enum';
import { Match } from 'src/generated/prisma/client';

/**
 * Validates that a match is in a valid betting window
 *
 * Requirements:
 * - Match status must be BETTING_OPEN
 * - Match start time must be at least 10 minutes away
 *
 * @param match - The match to validate
 * @param currentTime - The current time
 * @throws BadRequestException if validation fails
 */
export function validateMatchBettingWindow(
  match: Match,
  currentTime: Date,
): void {
  const tenMinutesInMillis = 10 * 60 * 1000;
  const bettingDeadline = new Date(match.utcDate.getTime() - tenMinutesInMillis);

  // Check if betting window has closed based on time
  if (currentTime >= bettingDeadline) {
    throw new BadRequestException(
      `Betting window is closed. Bets must be placed at least 10 minutes before match start time.`,
    );
  }

  // Check match status
  if (match.status !== MatchStatus.BETTING_OPEN) {
    throw new BadRequestException(
      `Betting for this match is not allowed. Status: ${match.status}`,
    );
  }
}
