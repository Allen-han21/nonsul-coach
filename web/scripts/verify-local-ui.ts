import { chromium } from '@playwright/test';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const answer =
  '저출산과 고령화가 함께 진행되면 보험료를 내는 인구는 줄고 급여를 받는 인구는 늘어난다. 국민연금은 노후 소득을 공동으로 보장하지만 세대 사이의 부담을 조정해야 한다. 싱가포르의 적립 방식은 개인 계정의 저축 성격이 강하므로 공동 보장과 운용 구조에서 차이가 있다. 따라서 보험료와 급여를 한쪽만 바꾸기보다 취약 계층의 보장을 유지하면서 부담의 예측 가능성을 높이는 조정이 필요하다.';
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.locator('#answer-input').fill(answer);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/analyze') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '피드백 받기', exact: true }).click();
  const response = await responsePromise;
  await page.getByRole('heading', { name: '내 답안의 피드백' }).waitFor();
  console.log(
    JSON.stringify({
      httpStatus: response.status(),
      feedbackVisible: await page
        .getByRole('heading', { name: '내 답안의 피드백' })
        .isVisible(),
      requirementCards: await page
        .locator('[aria-labelledby="requirements-title"] details.diagnosis')
        .count(),
      criterionCards: await page
        .locator('[aria-labelledby="criteria-title"] details.diagnosis')
        .count(),
      priorityHeading: await page.locator('#priorities-title').textContent(),
      activeElement: await page.evaluate(
        () => document.activeElement?.id ?? document.activeElement?.tagName,
      ),
      consoleErrorCount: consoleErrors.length,
    }),
  );
} finally {
  await browser.close();
}
