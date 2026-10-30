import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import { EmailService } from '../../backend/src/email/email.service';

const originalApiKey = process.env.RESEND_API_KEY;
delete process.env.RESEND_API_KEY;

after(() => {
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
});

test('email configuration is only required when sending an email', async () => {
  const service = new EmailService();

  await assert.rejects(
    service.sendPasswordResetOtp('test@example.com', '123456'),
    error => error instanceof ServiceUnavailableException,
  );
  await assert.rejects(
    service.sendTestEmail('test@example.com'),
    error => error instanceof ServiceUnavailableException,
  );
});
