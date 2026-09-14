import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAnalysis } from '../lib/server/http';
import { readBoundedText } from '../lib/server/openai-provider';
import { packages } from '../lib/server/package-data';
import type { AnalysisProvider } from '../lib/server/analysis';
const input = {
  packageId: packages[0].id,
  material: '합성 문제',
  answer: '합성 답안',
};
const request = (value: unknown = input, origin = 'http://localhost:3000') =>
  new Request('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
const fake: AnalysisProvider = {
  async generate(r) {
    const candidates = packages[0].criteria.map((c) => ({
      criterionId: c.id,
      concern: 'partial',
      quote: input.answer,
      occurrence: 0,
    }));
    return r.phase === 'draft'
      ? { materialMatch: 'match', candidates }
      : {
          materialMatch: 'match',
          reviews: candidates.map((c) => ({
            criterionId: c.criterionId,
            supported: true,
            concern: c.concern,
          })),
        };
  },
};
void test('runtime requires an explicit provider/model/key and operator non-retention confirmation', async () => {
  assert.equal((await handleAnalysis(request(), {})).status, 503);
  const response = await handleAnalysis(request(), {
    provider: 'openai',
    apiKey: 'fake-test-key',
    model: 'operator-selected',
    retentionConfirmed: 'false',
  });
  assert.equal(response.status, 503);
  assert.equal(
    ((await response.json()) as { code: string }).code,
    'PRIVACY_NOT_CONFIRMED',
  );
});
void test('same-origin JSON-only API rejects extra fields, invalid packages and oversized content without model calls', async () => {
  let calls = 0;
  const factory = () => ({
    async generate() {
      calls++;
      throw new Error();
    },
  });
  for (const req of [
    request(input, 'https://untrusted.example'),
    request({ ...input, studentName: '비공개' }),
    request({ ...input, packageId: 'natural' }),
    request({ ...input, answer: 'x'.repeat(6001) }),
    request({ ...input, material: 'x'.repeat(100001) }),
    new Request('http://localhost:3000/api/analyze', { method: 'GET' }),
  ]) {
    const result = await handleAnalysis(req, {}, factory);
    assert.ok([400, 403].includes(result.status));
  }
  assert.equal(calls, 0);
});
void test('obvious personal identifiers are blocked before any external analysis, without echoing them', async () => {
  for (const answer of [
    '010-1234-5678',
    'synthetic@example.invalid',
    '010101-3123456',
  ]) {
    const result = await handleAnalysis(
      request({ ...input, answer }),
      {},
      () => ({
        async generate() {
          throw new Error('must not call');
        },
      }),
    );
    assert.equal(result.status, 400);
    assert.ok(!(await result.text()).includes(answer));
  }
});
void test('responses have no-store, no private error bodies, and server timeouts are bounded', async () => {
  const result = await handleAnalysis(request(), {}, () => fake);
  assert.equal(result.status, 200);
  assert.match(result.headers.get('cache-control')!, /no-store/);
  assert.ok(!(await result.text()).includes('apiKey'));
  const error = await handleAnalysis(request(), {}, () => ({
    async generate() {
      throw new Error('private answer and key');
    },
  }));
  assert.equal(error.status, 502);
  assert.ok(!(await error.text()).includes('private answer and key'));
  const slow = await handleAnalysis(
    request(),
    {},
    () => ({ generate: () => new Promise(() => {}) }),
    10,
  );
  assert.equal(slow.status, 504);
});
void test('bounded stream reader counts bytes, cancels overflow, and handles split UTF-8', async () => {
  const bytes = new TextEncoder().encode('가나다');
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, 2));
      c.enqueue(bytes.slice(2));
      c.close();
    },
  });
  assert.equal(await readBoundedText(new Response(stream), 9), '가나다');
  let cancelled = false;
  const overflow = new ReadableStream({
    pull(c) {
      c.enqueue(bytes);
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBoundedText(new Response(overflow), 8),
    /BODY_LIMIT/,
  );
  assert.equal(cancelled, true);
});
