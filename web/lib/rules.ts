import {
  FeedbackSchema,
  type Evidence,
  type EvaluationPackage,
  type Feedback,
} from './schema';
export function paragraphs(answer: string) {
  return [...answer.matchAll(/\S[^\n\r]*(?:\r?\n(?!\s*\r?\n)[^\n\r]+)*/g)].map(
    (m) => ({ start: m.index!, end: m.index! + m[0].length }),
  );
}
export function evidenceAt(
  answer: string,
  start = 0,
  end = answer.length,
  scope: Evidence['scope'] = 'whole_answer',
): Evidence {
  const spans = paragraphs(answer);
  const first = Math.max(
    0,
    spans.findIndex((p) => p.end > start),
  );
  let last = spans.findIndex((p) => p.end >= end);
  if (last < 0) last = Math.max(0, spans.length - 1);
  return {
    quote: answer.slice(start, end),
    start,
    end,
    paragraphStart: first + 1,
    paragraphEnd: last + 1,
    scope,
  };
}
export function countAnswer(answer: string) {
  const text = answer.normalize('NFC').replace(/\r\n?/g, '\n');
  const graphemes = (value: string) =>
    Array.from(
      new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value),
    ).length;
  return {
    withSpaces: graphemes(text.replace(/\n/g, '')),
    withoutSpaces: graphemes(text.replace(/\s/g, '')),
    paragraphs: paragraphs(answer).length,
  };
}
export function runRules(pkg: EvaluationPackage, answer: string): Feedback[] {
  if (!answer.trim() || answer.length > 6000) throw new Error('Invalid answer');
  const counts = countAnswer(answer);
  const evidence = evidenceAt(answer);
  const base = {
    criterionId: 'requirements',
    priority: 1,
    evidence,
    source: pkg.source,
    kind: 'rule' as const,
    verified: true,
  };
  const item = (
    id: string,
    label: string,
    status: Feedback['status'],
    reason: string,
    question: string,
    action: string,
    priority = 1,
  ): Feedback =>
    FeedbackSchema.parse({
      ...base,
      id,
      label,
      status,
      reason,
      question,
      action,
      priority,
    });
  const under = counts.withSpaces < pkg.minLength;
  const over = counts.withoutSpaces > pkg.maxLength;
  const inside =
    counts.withoutSpaces >= pkg.minLength && counts.withSpaces <= pkg.maxLength;
  const lengthStatus = under || over ? '미충족' : inside ? '충족' : '확인 필요';
  const results = [
    item(
      'length',
      '답안 분량',
      lengthStatus,
      `공식 요구는 ${pkg.minLength}~${pkg.maxLength}자입니다. 공백 포함 ${counts.withSpaces}자, 공백 제외 ${counts.withoutSpaces}자입니다. ${under ? '두 참고 계산 모두 최소 분량보다 짧습니다.' : over ? '두 참고 계산 모두 최대 분량보다 깁니다.' : inside ? '두 참고 계산 모두 범위 안입니다.' : '공백 계산에 따라 범위 충족 여부가 달라집니다.'} 원고지 칸 계산법은 해당 기준에 명시되지 않아 이 값은 참고용입니다.`,
      under
        ? '아직 설명하지 못한 필수 과제나 논거는 무엇인가요?'
        : over
          ? '같은 뜻이 반복되는 부분을 줄여도 논거가 유지되나요?'
          : '실제 원고지에서 요구 분량을 지키는지 확인했나요?',
      under
        ? '답안 전체에서 빠진 내용 과제를 먼저 찾고 필요한 설명을 보완한 뒤 원고지 분량을 확인하세요.'
        : over
          ? '답안 전체에서 반복을 덜어 내고 핵심 논거를 유지한 채 원고지 분량을 확인하세요.'
          : '답안을 원고지 기준으로 다시 세어 분량을 확인하세요.',
    ),
  ];
  const found = pkg.requiredPassages.filter((label) =>
    new RegExp(
      `[<〈(（\\[]\\s*${label}\\s*[>〉)）\\]]|제시문\\s*${label}(?=\\s|은|는|의|에서|와|과|$)`,
    ).test(answer),
  );
  results.push(
    item(
      'passages',
      '요구 제시문 활용',
      '확인 필요',
      `공식 요구 제시문: ${pkg.requiredPassages.map((p) => `<${p}>`).join(', ')}. 기호가 확인된 제시문: ${found.length ? found.map((p) => `<${p}>`).join(', ') : '없음'}. 기호가 없어도 내용을 바꿔 쓸 수 있으므로 실제 활용·누락은 내용 분석으로 확인해야 합니다.`,
      '각 제시문을 어떤 주장이나 비교의 근거로 활용했나요?',
      '답안 전체에서 요구 제시문의 내용과 연결한 논거를 찾고, 필요한 연결을 분명히 하세요.',
    ),
  );
  const hints = pkg.concepts.filter((c) =>
    c.aliases.some((a) => answer.normalize('NFC').includes(a)),
  );
  results.push(
    item(
      'concepts',
      '필수 개념과 논리 요소',
      '확인 필요',
      `이 문항의 내용 기준: ${pkg.concepts.map((c) => c.label).join(', ')}. 관련 표현이 확인된 범주: ${hints.map((c) => c.label).join(', ') || '없음'}. 단어 검색은 단서일 뿐 의미 이해나 누락을 판정하지 않습니다.`,
      '핵심 개념을 내 논지에 맞게 설명하고 근거로 사용했나요?',
      '답안 전체에서 각 내용 기준을 다룬 위치를 찾아, 개념을 나열하는 데 그치지 않았는지 확인하세요.',
    ),
  );
  results.push(
    item(
      'tasks',
      '논제가 요구하는 수행 과제',
      '확인 필요',
      `요구 과제는 ${pkg.tasks.join(', ')}입니다. 특정 동사나 접속어만으로 수행 여부를 확정하지 않습니다.`,
      '문제가 요구한 각 행동을 답안의 어느 부분에서 수행했나요?',
      '답안의 각 부분이 담당하는 과제를 표시하고 빠진 논증 단계를 점검하세요.',
    ),
  );
  if (pkg.requiredWords.length) {
    const matched = pkg.requiredWords.filter((word) => answer.includes(word));
    results.push(
      item(
        'words',
        '명시된 필수 단어',
        matched.length === pkg.requiredWords.length
          ? '충족'
          : matched.length
            ? '부분 충족'
            : '미충족',
        `공식적으로 지정된 단어 ${pkg.requiredWords.length}개 중 ${matched.length}개가 문자 그대로 확인됩니다.`,
        '지정된 단어를 문맥에 맞게 사용했나요?',
        '답안 전체에서 공식 지정 단어의 사용 위치를 확인하고 누락을 보완하세요.',
      ),
    );
  }
  if (pkg.paragraphCount !== null)
    results.push(
      item(
        'paragraphs',
        '명시된 문단 형식',
        counts.paragraphs === pkg.paragraphCount ? '충족' : '미충족',
        `빈 줄로 구분한 문단은 ${counts.paragraphs}개이며 공식 요구는 ${pkg.paragraphCount}개입니다.`,
        '요구 문단 수에 맞춰 각 문단이 하나의 과제를 담당하나요?',
        '빈 줄로 문단을 구분하고 공식 요구 형식에 맞게 답안을 구성하세요.',
      ),
    );
  return results;
}
