// src/common/providers/date.provider.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class DateProvider {
  abstract now(): Date;
}

@Injectable()
export class SystemDateProvider extends DateProvider {
  now(): Date {
    return new Date();
  }
}
