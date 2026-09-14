import { test, expect } from '@playwright/test';
import { analyze } from '../../lib/server/analysis';
import { packages } from '../../lib/server/package-data';
import type { AnalysisInput } from '../../lib/schema';

async function syntheticResult(input: AnalysisInput) {
  const pkg = packages.find((p) => p.id === input.packageId)!;
  return analyze(input, pkg, {
    async generate(r) {
      const candidates = pkg.criteria.map((c) => ({
        criterionId: c.id,
        concern: input.answer.startsWith('수정') ? 'supported' : 'partial',
        quote: input.answer.split('\n')[0],
        occurrence: 0,
      }));
      return r.phase === 'draft'
        ? { candidates }
        : {
            reviews: candidates.map((c) => ({
              criterionId: c.criterionId,
              supported: true,
              concern: c.concern,
            })),
          };
    },
  });
}
test('input → source-linked feedback → exact evidence selection → revision on one screen', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const sent: AnalysisInput[] = [];
  // Test-only transport substitution. Production has no fixture response path.
  await page.route('**/api/analyze', async (route) => {
    const input = route.request().postDataJSON() as AnalysisInput;
    sent.push(input);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(await syntheticResult(input)),
    });
  });
  await page.goto('/');
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2027-mock-2');
  await page
    .getByLabel('학생 답안', { exact: true })
    .fill('합성 검증용 답안입니다.\n\n제시문 간 관계를 검토합니다.');
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '내 답안의 피드백' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '내 답안의 피드백' }),
  ).toBeFocused();
  await expect(page.locator('.priority-card')).toHaveCount(3);
  await expect(page.locator('.priority-card').first()).toContainText(
    '답안 분량',
  );
  const card = page.locator('.priority-card').nth(1);
  await expect(card).toContainText('스스로 묻기');
  await expect(card).toContainText('수정 행동');
  await card.locator('.source-detail summary').click();
  await expect(card).toContainText('2027-guide-20260701-sha256-94291ab4f3f7');
  await card.getByRole('button', { name: '입력란에서 근거 선택' }).click();
  const quoted = await page
    .getByLabel('학생 답안', { exact: true })
    .evaluate((el: HTMLTextAreaElement) =>
      el.value.slice(el.selectionStart, el.selectionEnd),
    );
  expect(quoted).toBe('합성 검증용 답안입니다.');
  await page
    .getByLabel('학생 답안', { exact: true })
    .fill('수정한 합성 답안입니다.\n\n관계를 설명하는 논거를 추가했습니다.');
  await expect(page.getByRole('status')).toContainText('수정 전 답안');
  await expect(
    card.getByRole('button', { name: '입력란에서 근거 선택' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '다시 피드백 받기', exact: true })
    .click();
  await expect(page.getByText('수정 전 답안', { exact: false })).toHaveCount(0);
  await expect(page.locator('.priority-card')).toHaveCount(1);
  expect(sent).toHaveLength(2);
  expect(sent[0].packageId).toBe(sent[1].packageId);
  expect(Object.keys(sent[1]).sort()).toEqual(['answer', 'packageId']);
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    sent[1].answer,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Only synthetic content appears in this screenshot.
  await page.screenshot({
    path: `test-results/feedback-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2026-1-1');
  await expect(
    page.getByRole('heading', { name: '내 답안의 피드백' }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue('');
  expect(errors).toEqual([]);
});
test('loading is cancellable, errors preserve input, and arbitrary server prose is not displayed', async ({
  page,
}) => {
  let release: (() => void) | undefined;
  await page.route('**/api/analyze', async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PROVIDER_FAILED',
          message: 'untrusted secret server prose',
        }),
      })
      .catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel('학생 답안', { exact: true }).fill('합성 답안');
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('재검증');
  await expect(page.getByLabel('학생 답안', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '분석 취소' }).click();
  release?.();
  await expect(page.getByRole('alert')).toContainText('취소');
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    '합성 답안',
  );
  await page.unroute('**/api/analyze');
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: '{"code":"PROVIDER_FAILED","message":"untrusted secret server prose"}',
    }),
  );
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '안전하게 확인하지 못했습니다',
  );
  await expect(page.getByText('untrusted secret server prose')).toHaveCount(0);
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    '합성 답안',
  );
});
test('unconfigured real local route reports setup blocker without an external analysis', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('학생 답안', { exact: true }).fill('합성 답안');
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    '외부 AI로 전송하지 않았습니다',
  );
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    '합성 답안',
  );
});
