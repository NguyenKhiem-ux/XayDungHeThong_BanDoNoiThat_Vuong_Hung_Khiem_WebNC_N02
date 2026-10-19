import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ChatbotKnowledge, KnowledgeStatus } from '../database/entities/chatbot-knowledge.entity';
import { Product } from '../database/entities/product.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatProductsService, productQuery } from './chat-products.service';
import { questionKey, similarity } from './chat-matching';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { IntentService } from './intent.service';
import { SmallTalkService } from './small-talk.service';
import { GeminiService } from './gemini.service';
import { GeminiDraft, RiskLevel } from './chat.types';

function memoryKnowledge() {
  const rows: ChatbotKnowledge[] = [];
  const matches = (row: ChatbotKnowledge, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => row[key as keyof ChatbotKnowledge] === value);
  const repo = {
    find: async ({ where }: any) => rows.filter(row => matches(row, where)),
    findOneBy: async (where: any) => rows.find(row => matches(row, where)) ?? null,
    countBy: async (where: any) => rows.filter(row => matches(row, where)).length,
    findAndCount: async ({ where, skip, take }: any) => {
      const found = rows.filter(row => matches(row, where));
      return [found.slice(skip, skip + take), found.length];
    },
    create: (row: any) => row,
    insert: async (data: any) => {
      if (rows.some(row => row.questionKey === data.questionKey && row.contextHash === data.contextHash)) throw { code: 'ER_DUP_ENTRY' };
      rows.push({ id: rows.length + 1, createdAt: new Date(), updatedAt: new Date(), ...data });
    },
    save: async (row: any) => {
      if (!row.id) { await repo.insert(row); return rows.at(-1); }
      Object.assign(rows.find(item => item.id === row.id)!, row);
      return row;
    },
    update: async (where: any, patch: any) => {
      const found = rows.filter(row => matches(row, where));
      found.forEach(row => Object.assign(row, patch));
      return { affected: found.length };
    },
    increment: async (where: any, key: 'usageCount', value: number) => {
      const found = rows.filter(row => matches(row, where));
      found.forEach(row => row[key] += value);
      return { affected: found.length };
    },
    delete: async (id: number) => {
      const index = rows.findIndex(row => row.id === id);
      if (index < 0) return { affected: 0 };
      rows.splice(index, 1);
      return { affected: 1 };
    },
    createQueryBuilder: () => {
      const query: any = {
        where: () => query, andWhere: () => query, orderBy: () => query, addOrderBy: () => query, take: () => query,
        getMany: async () => rows.filter(row => row.status === KnowledgeStatus.APPROVED && row.shouldStore && !row.contextHash),
      };
      return query;
    },
  };
  return { rows, repo };
}

test('matching preserves numbers, negation and different policy questions', () => {
  assert.equal(questionKey('Shop có giao hàng không?'), questionKey('Shop có ship hàng không?'));
  assert.equal(similarity('Shop có giao hàng không?', 'Cửa hàng có giao hàng không ạ?'), 1);
  assert.equal(similarity('Có ghế dưới 2 triệu không?', 'Có ghế dưới 3 triệu không?'), 0);
  assert.equal(similarity('Có ghế dưới 2 triệu không?', 'Có ghế trên 2 triệu không?'), 0);
  assert.ok(similarity('Shop có giao hàng không?', 'Shop có giao hàng miễn phí không?') < 0.9);
  assert.ok(similarity('Shop có giao hàng không?', 'Shop có đổi trả không?') < 0.9);
  assert.ok(similarity('Shop có giao hàng không?', 'Shop có giao hàng Hà Nội không?') < 0.9);
});

test('product budgets parse Vietnamese amounts and do not interpret greetings as furniture', () => {
  assert.equal(productQuery('Xin chào bạn').related, false);
  assert.equal(productQuery('Shop có giao hàng Hà Nội không?').related, false);
  assert.deepEqual(productQuery('Tôi đang tìm nồi cơm điện').terms, ['noi com dien']);
  assert.equal(productQuery('Tôi đang tìm nồi cơm điện').keyword, 'noi com dien');
  assert.deepEqual(productQuery('Máy hút bụi Dyson dưới 2 triệu').terms, ['may hut bui', 'dyson']);
  assert.equal(productQuery('Có ghế dưới 2 triệu không?').maxPrice, 2000000);
  assert.equal(productQuery('Có ghế dưới 2 triệu không?').maxExclusive, false);
  assert.equal(productQuery('Ghế không quá 2.000.000 đồng').maxExclusive, false);
  assert.equal(productQuery('Ghế dưới 1,5 triệu').maxPrice, 1500000);
  assert.equal(productQuery('Ghế dưới 500k').maxPrice, 500000);
  assert.equal(productQuery('Ghế từ 1 đến 2 triệu').minPrice, 1000000);
  assert.equal(productQuery('Ghế từ 1 đến 2 triệu').maxPrice, 2000000);
  assert.equal(productQuery('Phòng 10m2 nên chọn bàn nào?').related, true);
});

test('product lookup emits bounded parameterized MySQL with current price/stock filters', async () => {
  const source = new DataSource({ type: 'mysql', database: 'chat_test_metadata_only', entities: [Product, ChatbotKnowledge] });
  await (source as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  let queries = 0;
  let sql = '';
  let params: unknown[] = [];
  const products = new ChatProductsService({ createQueryBuilder: () => {
    const qb = source.getRepository(Product).createQueryBuilder('p');
    qb.getRawMany = async () => { queries++; [sql, params] = qb.getQueryAndParameters(); return []; };
    return qb;
  } } as unknown as Repository<Product>);
  assert.equal(await products.context('Xin chào'), null);
  assert.equal(await products.context('Sản phẩm này giá bao nhiêu?'), null);
  assert.equal(await products.context('Sản phẩm này còn hàng không?'), null);
  assert.equal(queries, 0);
  const context = await products.context('Có ghế dưới 2 triệu không?');
  assert.deepEqual(context?.products, []);
  assert.match(sql, /LIMIT 5/);
  assert.match(sql, /`p`\.`stock` > 0/);
  assert.match(sql, /`p`\.`price` <= \?/);
  assert.deepEqual(params, ['%ghe%', 2000000, '%ghe%']);
  assert.ok(!sql.includes('2000000'));
  await products.context('Ghế còn hàng không?');
  assert.ok(!sql.includes('`p`.`stock` > 0')); // Must be able to report an existing out-of-stock product.
  const meta = source.getMetadata(ChatbotKnowledge);
  assert.equal(meta.tableName, 'chatbot_knowledge');
  assert.ok(meta.indices.some(index => index.isUnique && index.columns.map(column => column.databaseName).join(',') === 'question_key,context_hash'));
});

test('HTTP chatbot: required scenarios, moderation, metadata, security and safe failures', async (t) => {
  const memory = memoryKnowledge();
  let snapshot = 'current-products';
  let productLookups = 0;
  const products = { context: async (message: string) => {
    const query = productQuery(message);
    if (!query.related || !query.terms.length) return null;
    productLookups++;
    return { hash: snapshot, products: [{ id: 7, name: 'Ghế gỗ', price: '1500000', stock: 2 }] };
  } };
  const config = new ConfigService({ JWT_SECRET: 'chat-test-only-secret', GEMINI_API_KEY: 'test-only-not-a-real-key' });
  const module = await Test.createTestingModule({
    controllers: [ChatController, KnowledgeController],
    providers: [ChatService, KnowledgeService, IntentService, SmallTalkService, GeminiService, JwtStrategy,
      { provide: ConfigService, useValue: config },
      { provide: ChatProductsService, useValue: products },
      { provide: getRepositoryToken(ChatbotKnowledge), useValue: memory.repo }],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const base = await app.getUrl();
  const chat = module.get(ChatService);
  let calls = 0;
  let failure: unknown = null;
  let lastRequest: any;
  let draft: GeminiDraft = { answer: 'Bản nháp chính sách chưa xác minh.', intent: 'shipping', confidence_score: 99, risk_level: RiskLevel.LOW, should_auto_approve: true };
  let raw: string | undefined;
  module.get(GeminiService)['ai']!.models.generateContent = async (request) => {
    calls++; lastRequest = request;
    if (failure) throw failure;
    return { text: raw ?? JSON.stringify(draft) } as any;
  };
  const jwt = new JwtService({ secret: 'chat-test-only-secret' });
  const token = (role: string) => jwt.sign({ sub: 1, role, email: 'test@example.test' });
  const request = async (path: string, method = 'GET', body?: unknown, role?: string) => {
    const response = await fetch(base + '/api' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: 'Bearer ' + token(role) } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() as any };
  };
  const send = (message: unknown, sessionId?: string) => request('/chat', 'POST', { message, ...(sessionId ? { sessionId } : {}) });
  const admin = '/admin/chatbot/knowledge';

  await t.test('existing JWT and ADMIN guards cover every admin route; DTO rejects bad input', async () => {
    for (const [method, path] of [['GET', admin], ['GET', admin + '/1'], ['POST', admin], ['PATCH', admin + '/1'], ['PATCH', admin + '/1/approve'], ['PATCH', admin + '/1/reject'], ['DELETE', admin + '/1'], ['GET', '/admin/chatbot/stats']]) {
      assert.equal((await request(path, method, undefined, 'USER')).status, 403);
      assert.equal((await request(path, method)).status, 401);
    }
    for (const message of ['', '   ', 42, null, 'x'.repeat(1001)]) assert.equal((await send(message)).status, 400);
    assert.equal((await request('/chat', 'POST', {})).status, 400);
    assert.equal((await request('/chat', 'POST', { message: 'Xin chào', status: 'approved' })).status, 400);
    assert.equal(calls, 0);
  });

  const smallCases = [
    ['1', 'Xin chào', 'greeting'], ['2', 'haha', 'small_talk'], ['3', 'hihi', 'small_talk'],
    ['4', 'Trời hôm nay đẹp thật', 'small_talk'], ['5', 'Cảm ơn bạn', 'thanks'],
    ['11', 'kkkkkkkk', 'small_talk'], ['12', '😊', 'small_talk'],
  ];
  const originalFind = memory.repo.find;
  memory.repo.find = async () => { throw new Error('Small talk must never read the database'); };
  for (const [number, message, intent] of smallCases) await t.test('TEST ' + number + ': ' + message, async () => {
    const result = await send(message);
    assert.equal(result.status, 201);
    assert.equal(result.data.source, 'small_talk');
    assert.equal(result.data.intent, intent);
    assert.equal(result.data.cached, false);
    assert.equal(calls, 0);
    assert.equal(productLookups, 0);
    assert.equal(memory.rows.length, 0);
  });
  memory.repo.find = originalFind;

  let shipping: ChatbotKnowledge;
  await t.test('TEST 6: shipping unknown -> draft only, HIGH despite model LOW/99', async () => {
    const response = await send('Shop có giao hàng không?');
    assert.equal(response.data.source, 'system');
    assert.ok(!response.data.message.includes(draft.answer));
    shipping = memory.rows[0];
    assert.equal(shipping.status, 'pending_review');
    assert.equal(shipping.riskLevel, 'HIGH');
    assert.equal(shipping.confidenceScore, 99);
    assert.equal(shipping.usageCount, 0);
    assert.equal(lastRequest.config.responseMimeType, 'application/json');
    assert.equal(lastRequest.config.httpOptions.retryOptions.attempts, 1);
    assert.equal(JSON.parse(lastRequest.contents).risk_level, 'HIGH');
    const before = calls;
    assert.equal((await send('Shop có ship hàng không?')).data.source, 'system');
    assert.equal(calls, before);
    assert.equal(memory.rows.length, 1);
  });
  await t.test('TEST 7: admin approves -> normalized and similarity knowledge hits', async () => {
    const approval = await request(admin + '/' + shipping.id + '/approve', 'PATCH', { reviewedBy: 999 }, 'ADMIN');
    assert.equal(approval.status, 200);
    assert.equal(approval.data.reviewedBy, 1); // JWT, never caller-supplied ID.
    assert.ok(approval.data.reviewedAt);
    const before = calls;
    const answer = await send('Shop có ship hàng không?');
    assert.equal(answer.data.source, 'knowledge');
    assert.equal(answer.data.cached, true);
    assert.equal(answer.data.message, draft.answer);
    assert.equal((await send('Cửa hàng có giao hàng không ạ?')).data.knowledgeId, shipping.id);
    assert.equal(calls, before);
    assert.equal(shipping.usageCount, 2);
    assert.equal(answer.data.confidenceScore, undefined);
    assert.equal(answer.data.riskLevel, undefined);
  });
  await t.test('TEST 8: chairs within 2M -> current product facts, zero Gemini calls', async () => {
    const before = calls;
    const answer = await send('Có ghế dưới 2 triệu không?');
    assert.equal(answer.data.source, 'product');
    assert.match(answer.data.message, /Ghế gỗ.*1.500.000đ.*2 chiếc/);
    assert.equal(calls, before);
    assert.ok(productLookups > 0);
    for (const question of ['Giá bao nhiêu?', 'Bao nhiêu tiền?', 'Còn hàng không?', 'Còn mấy cái?']) {
      assert.equal((await send(question)).data.source, 'system');
      assert.match((await send(question)).data.message, /sản phẩm nào/);
    }
  });
  await t.test('product search extracts natural language and keeps product context', async () => {
    const sessionId = 'chat-test-session';
    const before = calls;
    const first = await send('Tôi đang tìm nồi cơm điện', sessionId);
    assert.equal(first.data.source, 'product');
    assert.match(first.data.message, /Ghế gỗ/);
    assert.equal(first.data.products[0].id, 7);
    const stock = await send('Còn hàng không?', sessionId);
    assert.equal(stock.data.intent, 'product_stock');
    assert.match(stock.data.message, /còn 2 chiếc/);
    assert.equal(calls, before);
  });
  await t.test('TEST 9: safe general question -> model HIGH is normalized to LOW and reused', async () => {
    draft = { answer: 'Bạn nên chọn màu sáng, trung tính như trắng hoặc be, kết hợp bố trí gọn gàng để phòng thoáng hơn.', intent: 'general_question', confidence_score: 90, risk_level: RiskLevel.HIGH, should_auto_approve: true };
    const question = 'Phòng nhỏ nên chọn nội thất màu gì?';
    const answer = await send(question);
    assert.equal(answer.data.source, 'gemini');
    const row = memory.rows.find(item => item.question === question)!;
    assert.equal(row.status, 'approved');
    assert.equal(row.riskLevel, 'LOW');
    assert.equal(row.source, 'gemini');
    const before = calls;
    assert.equal((await send(question)).data.source, 'knowledge');
    assert.equal(calls, before);
  });
  await t.test('TEST 10: refund HIGH never auto-approves even if model says general/LOW/99', async () => {
    draft = { ...draft, confidence_score: 99 };
    const answer = await send('Chính sách hoàn tiền thế nào?');
    assert.equal(answer.data.source, 'system');
    assert.equal(memory.rows.at(-1)?.status, 'pending_review');
    assert.equal(memory.rows.at(-1)?.riskLevel, 'HIGH');
    assert.equal(memory.rows.at(-1)?.intent, 'refund');
  });
  await t.test('out of scope, spam and private customer data never reach Gemini/KB', async () => {
    const before = calls;
    const size = memory.rows.length;
    for (const question of ['Bạn biết code Python không?', 'Bạn có phải người thật không?', 'Bạn thích bóng đá không?', 'xin chào, tra cứu đơn hàng của tôi', 'Mật khẩu của tôi là 123456', 'ship ship ship ship ship ship', 'Liên hệ tôi tại private@example.test']) {
      assert.equal((await send(question)).data.source, 'system');
    }
    assert.equal(calls, before);
    assert.equal(memory.rows.length, size);
    assert.equal((await request(admin, 'POST', { question: 'haha', answer: 'haha' }, 'ADMIN')).status, 400);
    assert.equal((await request(admin, 'POST', { question: 'Xin chào', answer: 'Xin chào' }, 'ADMIN')).status, 400);
  });
  await t.test('admin filters, edits/rejects, product freshness and preserved legacy hidden entries', async () => {
    for (const query of ['status=invalid', 'risk=invalid', 'intent=invalid', 'page=0', 'limit=101']) {
      assert.equal((await request(admin + '?' + query, 'GET', undefined, 'ADMIN')).status, 400);
    }
    const filtered = await request(admin + '?status=pending_review&risk=HIGH&intent=refund', 'GET', undefined, 'ADMIN');
    assert.equal(filtered.data.total, 1);
    assert.equal((await request(admin + '?status=pending', 'GET', undefined, 'ADMIN')).status, 200);
    assert.equal((await request(admin + '/' + shipping.id, 'PATCH', { answer: null }, 'ADMIN')).status, 400);
    const edited = await request(admin + '/' + shipping.id, 'PATCH', { answer: 'Nội dung đã được admin sửa.' }, 'ADMIN');
    assert.equal(edited.data.status, 'pending_review');
    assert.equal(edited.data.source, 'admin');
    assert.equal(edited.data.reviewedBy, null);
    await request(admin + '/' + shipping.id + '/approve', 'PATCH', undefined, 'ADMIN');
    assert.equal((await send(shipping.question)).data.message, 'Nội dung đã được admin sửa.');
    await request(admin + '/' + shipping.id + '/reject', 'PATCH', undefined, 'ADMIN');
    const before = calls;
    assert.equal((await send(shipping.question)).data.source, 'system');
    assert.equal(calls, before);
    const chair = await request(admin, 'POST', { question: 'Có ghế dưới 2 triệu không?', answer: 'Ghế gỗ giá 1.500.000đ.' }, 'ADMIN');
    assert.equal(chair.status, 201);
    await request(admin + '/' + chair.data.id + '/approve', 'PATCH', undefined, 'ADMIN');
    assert.equal((await send(chair.data.question)).data.source, 'knowledge');
    snapshot = 'changed-price-or-stock';
    assert.equal((await send(chair.data.question)).data.source, 'product');
    assert.equal((await request(admin + '/' + chair.data.id + '/approve', 'PATCH', undefined, 'ADMIN')).status, 409);
    assert.equal((await request(admin + '/' + chair.data.id, 'DELETE', undefined, 'ADMIN')).status, 200);
    assert.equal((await request(admin + '/' + chair.data.id, 'GET', undefined, 'ADMIN')).status, 404);
    memory.rows.push({ ...shipping, id: 999, question: 'haha', questionKey: questionKey('haha'), shouldStore: false });
    const list = await request(admin, 'GET', undefined, 'ADMIN');
    assert.ok(!list.data.items.some((row: any) => row.id === 999));
  });
  await t.test('Gemini errors and invalid structured JSON never leak provider data or save knowledge', async () => {
    let serial = 0;
    for (const [error, status] of [[{ status: 429, message: 'sensitive provider data' }, 429], [{ name: 'TimeoutError' }, 504], [{ status: 503 }, 503], [{ status: 500 }, 500]] as const) {
      failure = error;
      const before = calls;
      const result = await send('Bảo hành tình huống ' + ++serial);
      assert.equal(result.status, status);
      assert.equal(calls, before + 1);
      assert.ok(!JSON.stringify(result.data).includes('sensitive provider data'));
    }
    failure = null;
    const size = memory.rows.length;
    for (const response of ['', 'not json', '{}', 'null', '[]', JSON.stringify({ ...draft, confidence_score: 101 }), JSON.stringify({ ...draft, confidence_score: '99' }), JSON.stringify({ ...draft, answer: ' ' }), JSON.stringify({ ...draft, risk_level: 'invalid' })]) {
      raw = response;
      assert.equal((await send('Bảo hành tình huống ' + ++serial)).status, 503);
    }
    raw = undefined;
    assert.equal(memory.rows.length, size);
  });
  await t.test('missing key, DB read/write errors are safe; small talk works during outages', async () => {
    const noKey = new ChatService(module.get(KnowledgeService), products as any, module.get(IntentService), module.get(SmallTalkService), new GeminiService(new ConfigService({ GEMINI_API_KEY: '' })));
    assert.equal((await noKey.send('Xin chào')).source, 'small_talk');
    assert.equal((await noKey.send('Phòng nhỏ nên chọn nội thất màu gì?')).source, 'knowledge');
    await assert.rejects(noKey.send('Bảo hành khác thế nào?'), (error: any) => error.getStatus() === 503);
    memory.repo.find = async () => { throw new Error('database password must not leak'); };
    const dbFailure = await send('Shop mở cửa lúc nào?');
    assert.equal(dbFailure.status, 503);
    assert.ok(!JSON.stringify(dbFailure.data).includes('password'));
    assert.equal((await send('Xin chào')).data.source, 'small_talk');
    memory.repo.find = originalFind;
    const originalInsert = memory.repo.insert;
    memory.repo.insert = async () => { throw new Error('write unavailable'); };
    const failedSave = await send('Shop có giao hàng tỉnh khác không?');
    assert.equal(failedSave.status, 201);
    assert.match(failedSave.data.message, /chưa lưu được/);
    assert.ok(!failedSave.data.message.includes('đã được ghi nhận'));
    assert.equal((await chat.stats()).pendingSaveFailures, 1);
    memory.repo.insert = originalInsert;
    const summary = await request('/admin/chatbot/stats', 'GET', undefined, 'ADMIN');
    assert.equal(summary.status, 200);
    assert.equal(summary.data.geminiCalls, calls);
    assert.equal(summary.data.autoApproved, 1);
    assert.ok(summary.data.smallTalkHandled >= 7);
    assert.ok(summary.data.knowledgeHits >= 4);
    assert.ok(summary.data.pendingReview > 0);
    assert.equal(summary.data.geminiUsageRate, Math.round(calls / summary.data.totalQuestions * 10000) / 100);
  });
});

test('intent rules and conservative auto-approve gate', () => {
  const intents = new IntentService(new SmallTalkService());
  for (const message of ['hahaha', 'hehe', 'kkk', 'lol', 'trời ơi', 'ôi', 'wow', 'hay quá', 'đẹp thật', 'hôm nay vui quá', 'buồn ngủ quá', 'chán quá', 'tôi đói', 'tôi đang uống cà phê', 'thời tiết hôm nay đẹp nhỉ', '[sticker]', 'tạm biệt', 'shop ngu', 'shop đẹp quá']) {
    assert.equal(intents.classify(message).shouldStore, false, message);
  }
  assert.equal(intents.classify('Có ship không?').intent, 'shipping');
  assert.equal(intents.classify('Xin chào, shop bảo hành sofa bao lâu?').riskLevel, 'HIGH');
  assert.equal(intents.classify('Giá bao nhiêu?').intent, 'product_price');
  const classification = intents.classify('Phòng nhỏ nên chọn nội thất màu gì?');
  const draft: GeminiDraft = { answer: 'Nên chọn màu trắng hoặc be để phòng thoáng hơn.', intent: 'general_question', confidence_score: 85, risk_level: RiskLevel.LOW, should_auto_approve: true };
  assert.equal(intents.canAutoApprove(classification, draft), true);
  assert.equal(intents.canAutoApprove(classification, { ...draft, confidence_score: 84 }), false);
  assert.equal(intents.canAutoApprove(classification, { ...draft, risk_level: RiskLevel.HIGH }), true);
  assert.equal(intents.canAutoApprove(classification, { ...draft, should_auto_approve: false }), false);
  for (const answer of ['Shop giao hàng miễn phí.', 'Giá chỉ 1990000đ.', 'Sản phẩm còn hàng.', 'Chưa có thông tin, cần kiểm tra.', 'Bảo hành trọn đời.']) {
    assert.equal(intents.canAutoApprove(classification, { ...draft, answer, confidence_score: 99 }), false);
  }
  assert.equal(intents.canAutoApprove(intents.classify('Chính sách hoàn tiền?'), draft), false);
});

test('Gemini prompt includes bounded approved RAG context', async () => {
  const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: 'test-only-not-a-real-key' }));
  const context = [{ question: 'Shop có giao hàng không?', answer: 'Câu trả lời đã được duyệt.', intent: 'shipping' as const }];
  const expected: GeminiDraft = {
    answer: 'Cần kiểm tra thêm.', intent: 'general_question', confidence_score: 90,
    risk_level: RiskLevel.LOW, should_auto_approve: false,
  };
  let request: any;
  (service as any).ai.models.generateContent = async (input: any) => {
    request = input;
    return { text: JSON.stringify(expected) };
  };
  await service.draft('Shop giao hàng thế nào?', { intent: 'shipping', riskLevel: RiskLevel.HIGH, shouldStore: true }, context, () => {});
  assert.deepEqual(JSON.parse(request.contents).context, context);
});
