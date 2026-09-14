import { test, expect } from '@playwright/test';

const actualQuestion1 =
  '제시문 <가>의 현상에 관하여 ㉠의 역할을 설명하고, 제시문 <나>와 <다>를 바탕으로 ㉠이 지속적으로 운영될 수 있는 방안에 대하여 논하시오. (900±100자)';
const actualQuestion2 =
  '제시문 <마>를 ㉡과 ㉢의 관점에 따라 평가하고, 그것을 근거로 제시문 <가>와 <나>를 참고하여 ㉠의 정당성과 한계를 논하시오. (900±100자)';
const mockQuestion1 =
  '생성형 인공지능 시대에도 교육은 왜 필수적인지 제시문 <가>, <나>, <다>의 관점을 종합하여 설명하시오. (800-1000자)';
const mockQuestion2 =
  '생성형 인공지능은 교육 기회를 확대하기도 하지만 새로운 불평등을 만들기도 한다. 제시문 <다>, <라>를 바탕으로 이러한 양면성의 구체적 양상을 분석하고, 이에 대한 자신의 견해를 논하시오. (800-1000자)';

test('four humanities questions show their official materials and keep only the answer editable', async ({
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
  await expect(page.locator('.official-question')).toContainText(
    actualQuestion1,
  );
  await expect(page.locator('.exam-notices li')).toHaveCount(5);
  await expect(page.locator('.exam-notices')).toContainText(
    '1. 시험 시간은 100분입니다.',
  );
  await expect(page.locator('.passage')).toHaveCount(5);
  await expect(page.locator('.passage h4')).toHaveText([
    '가제시문',
    '나제시문',
    '다제시문',
    '라제시문',
    '마제시문',
  ]);
  const populationFigure = page.locator('.passage figure img');
  await populationFigure.scrollIntoViewIfNeeded();
  await expect(populationFigure).toBeVisible();
  await expect
    .poll(() =>
      populationFigure.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.getByLabel('논술 문제·제시문')).toHaveCount(0);
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  await expect(page.getByLabel('학생 답안', { exact: true })).toBeFocused();
  await page
    .getByLabel('학생 답안', { exact: true })
    .fill('검증용 답안입니다.');
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2026-1-2');
  await expect(page.locator('.official-question')).toContainText(
    actualQuestion2,
  );
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2027-mock-1');
  await expect(
    page.getByText('생성형 AI 시대, 교육은 왜 필요한가', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.official-question')).toContainText(mockQuestion1);
  await expect(page.locator('.exam-directions')).toContainText(
    '※ 시험 시간: 100분, 답안 분량: 문제당 800 ~ 1,000자',
  );
  await expect(page.locator('.passage')).toHaveCount(4);
  await expect(page.locator('.passage figure')).toHaveCount(0);
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue(
    '검증용 답안입니다.',
  );
  await page.getByLabel('기출 연도·문항').selectOption('sungshin-2027-mock-2');
  await expect(
    page.getByText('AI의 교육 기회와 불평등', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.official-question')).toContainText(mockQuestion2);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '분석하기', exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel('학생 답안', { exact: true })).toHaveValue('');
  await expect(page.locator('.official-question')).toContainText(
    actualQuestion1,
  );
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
