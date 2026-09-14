import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/server/analysis';
import { packages, officialFor } from '../lib/server/package-data';

void test('AI success cannot override unresolved official length, and missing essential content outranks expression', async () => {
  const pkg = packages[2];
  const answer = '합성 검증 답안';
  const result = await analyze(
    { packageId: pkg.id, answer, material: '합성 자료' },
    pkg,
    {
      async generate(r) {
        const items = pkg.criteria.map((c) => ({
          criterionId: c.id,
          concern: c.id === 'm1-synthesis' ? 'missing' : 'supported',
          quote: c.id === 'm1-synthesis' ? null : answer,
          occurrence: c.id === 'm1-synthesis' ? null : 0,
        }));
        return r.phase === 'draft'
          ? { materialMatch: 'match', candidates: items }
          : {
              materialMatch: 'match',
              reviews: items.map((c) => ({
                criterionId: c.criterionId,
                concern: c.concern,
                supported: true,
              })),
            };
      },
    },
  );
  assert.equal(
    result.diagnoses.find((f) => f.id === 'm1-expression')?.status,
    '확인 필요',
  );
  assert.equal(
    result.diagnoses.find((f) => f.id === 'm1-synthesis')?.priority,
    1,
  );
  assert.ok(result.priorities.some((f) => f.id === 'm1-synthesis'));
});
void test('each package supplies the required official passages and relevant commentary to both passes', async () => {
  for (const pkg of packages) {
    const official = officialFor(pkg);
    await analyze(
      { packageId: pkg.id, answer: '합성 답안', material: '합성 자료' },
      pkg,
      {
        async generate(r) {
          for (const label of pkg.requiredPassages) {
            const passage = official.passages.find((p) => p.label === label);
            assert.ok(passage?.text);
            assert.ok(r.instructions.includes(passage.text.slice(0, 30)));
          }
          const items = pkg.criteria.map((c) => ({
            criterionId: c.id,
            concern: 'uncertain',
            quote: null,
            occurrence: null,
          }));
          return r.phase === 'draft'
            ? { materialMatch: 'match', candidates: items }
            : {
                materialMatch: 'match',
                reviews: items.map((c) => ({
                  criterionId: c.criterionId,
                  concern: c.concern,
                  supported: false,
                })),
              };
        },
      },
    );
  }
});
