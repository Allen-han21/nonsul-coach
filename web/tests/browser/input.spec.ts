import { test, expect } from '@playwright/test';
test('four humanities questions, labelled inputs and private local form', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('논술코치 | 성신여자대학교 인문계열');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'http://localhost:3000/og.png',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
    'content',
    'http://localhost:3000/og.png',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '내 글의 논리를 살펴보세요.',
  );
  await expect(page.getByLabel('목표 대학교')).toHaveValue('sungshin');
  await expect(
    page.getByRole('button', { name: '분석하기', exact: true }),
  ).toBeInViewport();
  await expect(page.getByLabel('기출 연도·문항').locator('option')).toHaveCount(
    4,
  );
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(page.getByLabel('논술 문제·제시문')).toBeFocused();
  await page
    .getByLabel('논술 문제·제시문')
    .fill('검증용 문제와 제시문입니다. 실제 학생 입력이 아닙니다.');
  await page
    .getByLabel('학생 답안', { exact: true })
    .fill('검증용 답안입니다.');
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2027-mock-1');
  await expect(
    page.getByText('생성형 AI 시대, 교육은 왜 필요한가', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    '검증용 답안입니다.',
  );
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2027-mock-2');
  await expect(
    page.getByText('AI의 교육 기회와 불평등', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: '분석하기', exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('논술 문제·제시문')).toHaveValue('');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `test-results/input-${info.project.name}.png`,
    fullPage: true,
  });
});
