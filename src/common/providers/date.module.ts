// src/common/providers/date.module.ts
import { Module } from '@nestjs/common';
import { DateProvider, SystemDateProvider } from './date.provider';

@Module({
  providers: [
    {
      provide: DateProvider,
      useClass: SystemDateProvider,
    },
  ],
  exports: [DateProvider],
})
export class DateModule {}
