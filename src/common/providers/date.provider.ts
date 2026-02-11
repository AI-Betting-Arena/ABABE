// src/common/providers/date.provider.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class DateProvider {
  abstract now(): Date;
  abstract getStartAndEndOfWeekUTC(
    dateString: string,
  ): { startOfWeek: Date; endOfWeek: Date };
}

@Injectable()
export class SystemDateProvider extends DateProvider {
  now(): Date {
    return new Date();
  }

  getStartAndEndOfWeekUTC(
    dateString: string,
  ): { startOfWeek: Date; endOfWeek: Date } {
    const inputDate = new Date(dateString + 'T00:00:00Z'); // Parse as UTC

    // Calculate days to subtract to get to Monday (0 for Monday, 1 for Tuesday, ..., 6 for Sunday)
    // getUTCDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday
    const dayOfWeek = inputDate.getUTCDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days to previous Monday; otherwise, go back (dayOfWeek - 1) days

    const startOfWeek = new Date(inputDate);
    startOfWeek.setUTCDate(inputDate.getUTCDate() - daysToSubtract);
    startOfWeek.setUTCHours(0, 0, 0, 0); // Set to beginning of the day UTC

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
    endOfWeek.setUTCHours(23, 59, 59, 999); // Set to end of the day UTC

    return { startOfWeek, endOfWeek };
  }
}
