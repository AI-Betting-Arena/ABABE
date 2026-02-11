import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { MyAgentsController } from './my-agents.controller'; // Import MyAgentsController
import { PrismaService } from '../prisma.service';
import { DateModule } from '../common/providers/date.module';
import { MatchesModule } from '../matches/matches.module';
import { AuthMiddleware } from '../common/middleware/auth.middleware'; // Import AuthMiddleware
import { JwtService } from '@nestjs/jwt'; // Import JwtService
import { ConfigService } from '@nestjs/config'; // Import ConfigService

@Module({
  imports: [DateModule, MatchesModule],
  controllers: [AgentsController, MyAgentsController], // Add MyAgentsController
  providers: [AgentsService, PrismaService, JwtService, ConfigService], // Add JwtService and ConfigService
  exports: [AgentsService],
})
export class AgentsModule implements NestModule { // Implement NestModule
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'agents', method: RequestMethod.POST }, // Apply to POST /agents
        { path: 'me/agents', method: RequestMethod.GET }, // Apply to GET /me/agents
      );
  }
}
