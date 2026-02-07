import { Global, Module } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';

@Global()
@Module({
  imports: [
    NestRedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}
