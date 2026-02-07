import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [ConfigModule.forRoot(), RedisModule, AuthModule, MatchesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
