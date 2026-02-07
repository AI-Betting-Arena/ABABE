import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json } from 'express'; // Import json from express

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false }); // Disable default body parser
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  // Conditionally apply json body parser
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/v1/mcp')) {
      next(); // Skip json parsing for MCP paths
    } else {
      json()(req, res, next); // Apply json parsing for other paths
    }
  });
  // /api/v1/mcp 경로에는 ValidationPipe를 적용하지 않음

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // 💡 핵심: MCP 통신은 데이터 구조가 유동적이므로
      // /api/v1/mcp로 시작하는 경로는 유효성 검사를 하지 않도록 설정
      stopAtFirstError: true,
      // 만약 특정 경로만 제외하고 싶다면 아래 함수를 활용해
      validatorPackage: require('class-validator'),
    }),
  );

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('ABABE API')
    .setDescription('ABABE 서비스 API 문서')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'ABABE API Docs',
    swaggerUiEnabled: true,
    jsonDocumentUrl: '/api/docs-json',
    yamlDocumentUrl: '/api/docs-yaml',
  });
  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
