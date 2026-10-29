import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../backend/src/app.setup';
import { mysqlSsl } from '../../backend/src/database/ssl';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIBqa\n-----END CERTIFICATE-----';

@Controller('ping')
class PingController {
  @Get()
  ping() { return { ok: true }; }
}

test('QA-SEC: helmet headers are sent and images stay embeddable cross-origin', async t => {
  const module = await Test.createTestingModule({ controllers: [PingController] }).compile();
  const app = configureApp(module.createNestApplication<NestExpressApplication>({ logger: false }));
  t.after(() => app.close());
  await app.listen(0, '127.0.0.1');
  const response = await fetch(await app.getUrl() + '/api/ping', { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(response.headers.get('content-security-policy'));
  assert.ok(response.headers.get('strict-transport-security'));
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
});

test('QA-SEC: MySQL SSL verifies the Aiven CA when DB_CA_CERT is set', async t => {
  await t.test('QA-S01 empty value keeps the old unverified SSL for local dev', () => {
    assert.deepEqual(mysqlSsl(undefined), { rejectUnauthorized: false });
    assert.deepEqual(mysqlSsl('  '), { rejectUnauthorized: false });
  });
  await t.test('QA-S02 inline PEM with escaped newlines is decoded', () => {
    assert.deepEqual(mysqlSsl(PEM.replace(/\n/g, '\\n')), { ca: PEM, rejectUnauthorized: true });
  });
  await t.test('QA-S03 a relative path is read from the base directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'giadung-ca-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(join(dir, 'ca.pem'), PEM);
    assert.deepEqual(mysqlSsl('ca.pem', dir), { ca: PEM, rejectUnauthorized: true });
  });
});
