import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { MatchesModule } from './matches/matches.module';
import { McpModule } from './mcp/mcp.module';
import { PredictionsModule } from './predictions/predictions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available globally
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    AuthModule,
    MatchesModule,
    McpModule,
    PredictionsModule,
    SettlementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
