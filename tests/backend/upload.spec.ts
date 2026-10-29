import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductsController } from '../../backend/src/products/products.controller';
import { ProductsService } from '../../backend/src/products/products.service';
import { JwtAuthGuard } from '../../backend/src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../backend/src/common/guards/roles.guard';

test('QA-UPLOAD: product image upload accepts only jpg/png/webp and names files by mimetype', async t => {
  const saved: string[] = [];
  const module = await Test.createTestingModule({
    controllers: [ProductsController],
    providers: [{ provide: ProductsService, useValue: { create: async (_dto: unknown, image?: string) => { if (image) saved.push(image); return { imageUrl: image }; } } }],
  }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
  const app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  mkdirSync(join(process.cwd(), 'uploads/products'), { recursive: true });
  t.after(async () => {
    await app.close();
    for (const url of saved) rmSync(join(process.cwd(), url), { force: true });
  });
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const upload = async (name: string, type: string, content = 'x') => {
    const form = new FormData();
    form.append('name', 'Nồi chiên QA');
    form.append('price', '990000');
    form.append('stock', '3');
    form.append('image', new Blob([content], { type }), name);
    const response = await fetch(base + '/products', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() };
  };

  await t.test('QA-U01 HTML and SVG uploads are rejected with 400 and nothing is stored', async () => {
    for (const [name, type] of [['x.html', 'text/html'], ['x.svg', 'image/svg+xml'], ['x.gif', 'image/gif']]) {
      const result = await upload(name, type, '<svg onload="alert(1)"/>');
      assert.equal(result.status, 400, name);
      assert.match(result.body.message, /JPG, PNG hoặc WEBP/);
    }
    assert.equal(saved.length, 0);
  });

  await t.test('QA-U02 valid images are stored with an extension derived from the mimetype', async () => {
    for (const [name, type, ext] of [['photo.JPEG', 'image/jpeg', '.jpg'], ['a.png', 'image/png', '.png'], ['b.html', 'image/webp', '.webp']]) {
      const result = await upload(name, type);
      assert.ok([200, 201].includes(result.status), name);
      assert.ok(result.body.imageUrl.startsWith('/uploads/products/') && result.body.imageUrl.endsWith(ext), result.body.imageUrl);
      assert.ok(existsSync(join(process.cwd(), result.body.imageUrl)));
    }
  });
});
