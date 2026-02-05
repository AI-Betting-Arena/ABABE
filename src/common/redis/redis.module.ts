import { Global, Module } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';

@Global()
@Module({
  imports: [
    NestRedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
  ],
  exports: [NestRedisModule],
})
export class RedisModule {}