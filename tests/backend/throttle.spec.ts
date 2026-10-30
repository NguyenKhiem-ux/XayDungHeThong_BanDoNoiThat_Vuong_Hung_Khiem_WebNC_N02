import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '../../backend/src/auth/auth.controller';
import { AuthService } from '../../backend/src/auth/auth.service';
import { PaymentController } from '../../backend/src/payment/payment.controller';
import { PaymentService } from '../../backend/src/payment/payment.service';
import { DEFAULT_THROTTLE, THROTTLE_MESSAGE } from '../../backend/src/common/throttle';

test('QA-RATE: sensitive routes are rate limited per route while the PayOS webhook is exempt', async t => {
  const module = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot({ throttlers: [DEFAULT_THROTTLE], errorMessage: THROTTLE_MESSAGE })],
    controllers: [AuthController, PaymentController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: AuthService, useValue: { verifyResetOtp: async () => ({ ok: true }), login: async () => ({ ok: true }) } },
      { provide: PaymentService, useValue: { handlePayOSWebhook: async () => ({ ok: true }) } },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = async (path: string) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'buyer@example.test', otp: '123456', identifier: 'buyer', password: 'x' }), signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() };
  };

  await t.test('QA-R01 OTP verification allows 5 attempts then returns 429 with a Vietnamese message', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await post('/auth/verify-reset-otp')).status, 201);
    const blocked = await post('/auth/verify-reset-otp');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.message, THROTTLE_MESSAGE);
  });

  await t.test('QA-R02 limits are counted per route, so a blocked OTP route does not block login', async () => {
    assert.equal((await post('/auth/login')).status, 201);
  });

  await t.test('QA-R03 PayOS webhook is never throttled', async () => {
    for (let i = 0; i < DEFAULT_THROTTLE.limit + 5; i++) assert.equal((await post('/payment/payos/webhook')).status, 201);
  });
});
