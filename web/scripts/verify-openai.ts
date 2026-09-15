import { analyze } from '../lib/server/analysis';
import {
  createOpenAIProvider,
  type OpenAIUsage,
} from '../lib/server/openai-provider';
import { packages } from '../lib/server/package-data';

const syntheticAnswers: Record<string, string> = {
  'sungshin-2026-1-1':
    '저출산과 고령화가 함께 진행되면 보험료를 내는 인구는 줄고 급여를 받는 인구는 늘어난다. 국민연금은 노후 소득을 공동으로 보장하지만 세대 사이의 부담을 조정해야 한다. 싱가포르의 적립 방식은 개인 계정의 저축 성격이 강하므로 공동 보장과 운용 구조에서 차이가 있다. 따라서 보험료와 급여를 한쪽만 바꾸기보다 취약 계층의 보장을 유지하면서 부담의 예측 가능성을 높이는 조정이 필요하다.',
  'sungshin-2026-1-2':
    '청구인은 재산권과 선택의 자유가 침해된다고 보지만 재판부는 사회적 위험을 함께 분담하는 제도의 목적을 인정한다. 노직의 관점은 강제 가입의 정당성을 엄격히 묻고, 롤스의 관점은 불리한 사람의 노후를 보장하는 장치를 정당화할 수 있다. 다만 인구구조가 바뀌면 현재 방식의 부담이 특정 세대에 집중될 수 있으므로 최소 보장의 목적을 유지하면서 부담과 급여의 기준을 공개적으로 조정해야 한다.',
  'sungshin-2027-mock-1':
    'AI는 개인별 설명과 자료 접근을 넓혀 학습 기회를 확장하지만, 답을 그대로 받아들이게 하면 비판적 사고와 지식 생산의 주체성이 약해질 수 있다. 인간 자본의 관점에서 교육은 새로운 도구를 다루고 판단하는 능력을 길러 생산성을 높이므로 경제적 의의가 유지된다. 또한 교육은 타인과 규칙을 배우는 사회화 과정이며 기존 격차를 되풀이할 위험도 있다. 그러므로 학교는 AI 활용 능력과 출처 검증, 토론과 협력 활동을 함께 가르쳐야 한다.',
  'sungshin-2027-mock-2':
    'AI가 누구에게나 같은 도구라는 주장은 형식적으로는 타당하지만 문화 자본과 지원 환경이 다르면 활용 결과도 달라진다. 기기와 서비스에 접근하지 못하는 격차는 사용 기회를 제한하고, 디지털 문해력과 편향된 데이터의 차이는 같은 접근 뒤에도 결과의 불평등을 만든다. AI는 교육 기회를 넓힐 수 있으나 자동으로 평등을 보장하지 않는다. 공공 접근 시설, 문해력 교육, 데이터 점검과 이의 제기 절차를 함께 마련해야 한다.',
  'sungshin-2026-2-1':
    '소비는 필요한 효용과 즐거움을 주고 사람들 사이의 취향 공동체를 만들 수 있지만, 비교 심리와 과도한 지출은 스트레스와 소외를 낳는다. 라부부를 모으는 행위도 기대와 교환의 즐거움, 팬 사이의 유대감을 제공한다. 그러나 희소성과 타인의 소유를 의식할수록 더 많이 사야 한다는 불안이 커지고 경제적 부담도 늘어난다. 만족을 얻으려 한 소비가 다시 결핍감을 만드는 점에서 심리적 역설이 나타난다.',
  'sungshin-2026-2-2':
    '블라인드 박스는 결과를 알 수 없는 기대를, 소소한 즐거움 시장은 작은 보상을, 플래그십 스토어는 체험과 브랜드 공동체를 자극한다. 자유주의적 정의관에서는 소비자의 자발적 선택과 기업가의 시장 개척, 정당한 이윤 추구를 존중할 수 있다. 그러나 반복 구매와 투기를 유도해 공동체에 비용을 떠넘긴다면 기업에도 정보 공개와 구매 보호의 책임이 있다. 확률 공개와 미성년자 보호 같은 조정은 선택 자체를 없애기보다 책임 있는 시장을 만든다.',
};

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.ANALYSIS_MODEL?.trim() || 'gpt-5.6-terra';
if (!apiKey)
  throw new Error('OPENAI_API_KEY is not available to this process.');

const selected = process.argv.includes('--all')
  ? packages
  : packages.slice(0, 1);
const totals: OpenAIUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
const provider = createOpenAIProvider(
  {
    apiKey,
    model,
    onUsage(usage) {
      totals.inputTokens += usage.inputTokens;
      totals.outputTokens += usage.outputTokens;
      totals.totalTokens += usage.totalTokens;
    },
  },
  async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok) {
      let error: { type?: unknown; code?: unknown; param?: unknown } = {};
      try {
        const payload = (await response.clone().json()) as {
          error?: typeof error;
        };
        error = payload.error ?? {};
      } catch {
        // Status alone is enough when the upstream body is not JSON.
      }
      console.error(
        JSON.stringify({
          upstreamStatus: response.status,
          errorType: error.type,
          errorCode: error.code,
          errorParam: error.param,
        }),
      );
    }
    return response;
  },
);

for (const pkg of selected) {
  const startedAt = Date.now();
  const result = await analyze(
    { packageId: pkg.id, answer: syntheticAnswers[pkg.id] },
    pkg,
    provider,
    AbortSignal.timeout(120_000),
  );
  console.log(
    JSON.stringify({
      packageId: pkg.id,
      analysisMode: result.analysisMode,
      verifiedCriteria: result.diagnoses.filter((item) => item.verified).length,
      criterionCount: result.diagnoses.length,
      priorityCount: result.priorities.length,
      durationMs: Date.now() - startedAt,
    }),
  );
}

console.log(
  JSON.stringify({ model, requests: selected.length * 2, usage: totals }),
);
