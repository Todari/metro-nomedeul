import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const allowedOrigin = configService.get<string>(
    'ALLOWED_ORIGIN',
    'http://localhost:5173',
  );

  app.enableCors({
    origin: allowedOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.listen(port);
  console.log(`Server running on port ${port}`);
}
bootstrap();
