import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { captureException, initSentry } from './common/sentry';

initSentry();

const logger = new Logger('Bootstrap');

process.on('unhandledRejection', (reason) => {
  captureException(reason);
  logger.error(
    `Unhandled Promise Rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
});

process.on('uncaughtException', (error) => {
  captureException(error);
  logger.error(`Uncaught Exception: ${error.stack ?? error.message}`);
  // Give logs a chance to flush, then exit so the process supervisor restarts us.
  setTimeout(() => process.exit(1), 1000).unref();
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const allowedOrigin = configService.get<string>('ALLOWED_ORIGIN');

  if (!allowedOrigin && nodeEnv === 'production') {
    throw new Error('ALLOWED_ORIGIN environment variable is required in production');
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: (allowedOrigin || 'http://localhost:5173').split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Server running on port ${port}`);
}
bootstrap().catch((err) => {
  logger.error(`Bootstrap failed: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});
