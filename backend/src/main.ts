// file là điểm khởi chạy của backend nestjs và cấu hình server http.
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  mkdirSync(join(process.cwd(), 'uploads/products'), { recursive: true });
  mkdirSync(join(process.cwd(), 'uploads/avatars'), { recursive: true });
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule));
  await app.listen(Number(process.env.PORT ?? 3000));
}

bootstrap();
