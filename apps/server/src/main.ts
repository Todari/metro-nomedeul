import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const allowedOrigin = configService.get<string>('ALLOWED_ORIGIN');

  if (!allowedOrigin && nodeEnv === 'production') {
    throw new Error('ALLOWED_ORIGIN environment variable is required in production');
  }

  app.enableCors({
    origin: (allowedOrigin || 'http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Server running on port ${port}`);
}
bootstrap();
