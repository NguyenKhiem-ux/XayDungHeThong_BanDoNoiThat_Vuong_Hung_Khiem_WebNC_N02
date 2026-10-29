// file là điểm khởi chạy của backend nestjs và cấu hình server http.
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'uploads/products'), { recursive: true });
  mkdirSync(join(process.cwd(), 'uploads/avatars'), { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Sau ngrok/reverse proxy, mọi request có cùng IP proxy; TRUST_PROXY=1 để rate limit đọc IP thật từ X-Forwarded-For.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap();
