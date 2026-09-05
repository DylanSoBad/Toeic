import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAppServer } from '../server.js';
import { generateExercises, validateGenerationConfig, generateMockPayload, buildOutputSchema } from '../server/ai-service.js';
test('static server isolates private files, handles query strings, traversal, malformed bodies and mock generation', async t => {
  const server = createAppServer({ env: {} }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/?cache=1')).status, 200);
  assert.match((await fetch(base + '/js/app.js?v=1')).headers.get('content-type'), /javascript/);
  for (const target of ['/server.js', '/package.json', '/.env', '/.git/config', '/server/ai-service.js', '/test/suite.js']) assert.ok((await fetch(base + target)).status >= 400, target);
  const raw = path => new Promise((resolve, reject) => { http.get(base, { path }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject); });
  for (const target of ['/../.env', '/%2e%2e/server.js', '/js/%2e%2e/%2e%2e/.env', '/js%5c..%5c.env', '/%252e%252e/.env']) assert.ok(await raw(target) >= 400, target);
  const post = body => fetch(base + '/api/ai-generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  assert.equal((await post('{')).status, 400);
  assert.equal((await post(' '.repeat(33000))).status, 413);
  assert.equal((await post({ skill: 'reading', part: 5, count: 1 })).status, 503);
  const result = await post({ skill: 'reading', part: 6, count: 1, useMock: true });
  assert.equal(result.status, 200); const data = await result.json(); assert.equal(data.items[0].questions.length, 4); assert.equal(data.items[0].status, 'draft');
  const forbidden = await fetch(base + '/api/ai-generate', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.org' }, body: '{}' });
  assert.equal(forbidden.status, 403);
});
test('mock payloads validate every supported Part without credentials', async () => {
  for (let part = 1; part <= 7; part++) {
    const result = await generateExercises({ skill: part <= 4 ? 'listening' : 'reading', part, count: 2, useMock: true }, { env: {} });
    assert.equal(result.items.length, 2); assert.equal(result.isMock, true); assert.ok(result.items.every(q => q.status === 'draft'));
  }
  for (const skill of ['speaking', 'writing', 'vocabulary', 'grammar']) {
    const result = await generateExercises({ skill, part: 1, count: 2, useMock: true }, { env: {} });
    assert.equal(result.items.length, 2); assert.ok(result.items.every(q => q.skill === skill && q.status === 'draft'));
  }
});
test('provider call uses strict schema, preserves context, validates and strips failure details', async () => {
  let captured;
  const config = { skill: 'reading', part: 5, count: 1, level: 'beginner', targetScore: 600, errorTypes: ['word-form'] };
  const normalized = validateGenerationConfig(config);
  const payload = generateMockPayload(normalized);
  const fetchImpl = async (_, options) => { captured = JSON.parse(options.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] })); };
  const result = await generateExercises(config, { env: { OPENAI_API_KEY: 'test-fixture-not-a-secret' }, fetchImpl });
  assert.equal(result.isMock, false); assert.equal(captured.response_format.json_schema.strict, true);
  assert.equal(captured.store, false); assert.equal(Number(JSON.parse(captured.messages[1].content).targetScore), 600);
  assert.deepEqual(captured.response_format.json_schema.schema, buildOutputSchema(normalized));
  const badFetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{broken' } }] }));
  await assert.rejects(generateExercises(config, { env: { OPENAI_API_KEY: 'fixture' }, fetchImpl: badFetch }), /JSON lỗi/);
  await assert.rejects(generateExercises(config, { env: { OPENAI_API_KEY: 'fixture' }, fetchImpl: async () => new Response('private provider body', { status: 401 }) }), error => !error.message.includes('private provider'));
});
test('AI timeout and missing key are explicit and never become fake success', async () => {
  const config = { skill: 'reading', part: 5, count: 1 };
  await assert.rejects(generateExercises(config, { env: {} }), error => error.code === 'AI_NOT_CONFIGURED');
  await assert.rejects(generateExercises(config, { env: { OPENAI_API_KEY: 'fixture' }, timeoutMs: 10, fetchImpl: async () => new Promise(() => {}) }), error => error.code === 'AI_TIMEOUT');
});
