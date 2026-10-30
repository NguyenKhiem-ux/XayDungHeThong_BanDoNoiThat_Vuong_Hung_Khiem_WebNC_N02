// file cấu hình chung cho ứng dụng http (bảo mật, CORS, validation), dùng cho main.ts và test.
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export function configureApp(app: NestExpressApplication) {
  // Sau ngrok/reverse proxy, mọi request có cùng IP proxy; TRUST_PROXY=1 để rate limit đọc IP thật từ X-Forwarded-For.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  // Ảnh /uploads được frontend ở origin khác (cổng 5173) nhúng nên phải cho phép cross-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  return app;
}
