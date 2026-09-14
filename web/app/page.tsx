'use client';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SubmitEvent,
} from 'react';
import { ArrowRight, BookOpen, ShieldCheck, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { FeedbackView } from '@/components/feedback';
import { OfficialMaterial } from '@/components/official-material';
import { ResultSchema, type AnalysisResult, type Evidence } from '@/lib/schema';
import { countAnswer } from '@/lib/rules';

const choices = [
  {
    id: 'sungshin-2026-1-1',
    label: '2026 기출 · 1교시 문제 1',
    topic: '국민연금의 역할과 지속 가능한 운영',
    pages: '37 · 43 · 46–48',
    tasks: [
      '인구 변화와 국민연금의 역할',
      '두 연금 운용 방식의 비교',
      '역할과 일관된 운영 방안',
    ],
    exam: 'actual' as const,
    questionIndex: 0,
  },
  {
    id: 'sungshin-2026-1-2',
    label: '2026 기출 · 1교시 문제 2',
    topic: '정의관으로 바라본 국민연금',
    pages: '37 · 44–48',
    tasks: [
      '롤스·노직의 관점과 판결 평가',
      '연금의 정당성과 한계',
      '내용의 정합성과 논리적 연결',
    ],
    exam: 'actual' as const,
    questionIndex: 1,
  },
  {
    id: 'sungshin-2026-2-1',
    label: '2026 기출 · 2교시 문제 1',
    topic: '라부부 소비와 심리적 역설',
    pages: '52 · 55–58 · 59–60',
    tasks: [
      '소비활동의 긍정적·부정적 효과',
      '라부부 문화에 나타난 심리적 역설',
      '제시문 적용과 논리적 연결',
    ],
    exam: 'actual2' as const,
    questionIndex: 0,
  },
  {
    id: 'sungshin-2026-2-2',
    label: '2026 기출 · 2교시 문제 2',
    topic: '팝마트 판매전략과 기업의 책임',
    pages: '52 · 56–57 · 59–60',
    tasks: [
      '세 가지 판매전략과 소비자 행동',
      '기업가정신과 자유주의적 정의관',
      '기업윤리와 공동체주의적 정의관',
    ],
    exam: 'actual2' as const,
    questionIndex: 1,
  },
  {
    id: 'sungshin-2027-mock-1',
    label: '2027 모의논술 · 문제 1',
    topic: '생성형 AI 시대, 교육은 왜 필요한가',
    pages: '93 · 97 · 99–102',
    tasks: [
      'AI 시대의 변화와 비판적 사고',
      '교육의 경제적·사회적 의미',
      '세 제시문 관점의 통합',
    ],
    exam: 'mock' as const,
    questionIndex: 0,
  },
  {
    id: 'sungshin-2027-mock-2',
    label: '2027 모의논술 · 문제 2',
    topic: 'AI의 교육 기회와 불평등',
    pages: '93 · 98–102',
    tasks: [
      '불평등 재생산과 기술 중립성',
      '디지털 문해력 격차와 편향',
      '자신의 견해와 해결 방향',
    ],
    exam: 'mock' as const,
    questionIndex: 1,
  },
];
const subscribeHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;
export default function Home() {
  const ready = useSyncExternalStore(
    subscribeHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const [id, setId] = useState(choices[0].id);
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [snapshot, setSnapshot] = useState<{ answer: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!result) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById('feedback-title')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [result]);
  const selected = choices.find((c) => c.id === id)!;
  const count = countAnswer(answer).withSpaces;
  const stale = !!snapshot && snapshot.answer !== answer;
  function locate(evidence?: Evidence) {
    const element = answerRef.current;
    if (!element) return;
    element.focus();
    if (evidence) element.setSelectionRange(evidence.start, evidence.end);
    element.scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (controller.current) return;
    if (!answer.trim()) {
      setNotice('학생 답안을 입력해 주세요.');
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setNotice('');
    const timeout = setTimeout(() => current.abort(), 60_000);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: id, answer }),
        signal: current.signal,
        cache: 'no-store',
      });
      const data: unknown = await response.json();
      if (controller.current !== current) return;
      if (!response.ok) {
        const code = (data as { code?: string })?.code;
        const messages: Record<string, string> = {
          NOT_CONFIGURED:
            '분석 서버 연결이 아직 완료되지 않았습니다. 입력은 유지되며 외부 AI로 전송하지 않았습니다.',
          PRIVACY_NOT_CONFIRMED:
            '분석 제공자의 답안 비저장 설정이 확인되지 않아 전송을 중단했습니다. 운영자의 설정 확인이 필요합니다.',
          PRIVATE_INPUT:
            '개인정보로 보이는 내용이 있습니다. 연락처·이메일·주민등록번호를 지운 뒤 다시 시도해 주세요.',
          INVALID_INPUT:
            '학생 답안을 확인해 주세요. 답안은 6,000자 이내로 입력해 주세요.',
          TIMEOUT:
            '분석 시간이 초과되었습니다. 입력은 유지되니 잠시 후 다시 시도해 주세요.',
        };
        setNotice(
          messages[code ?? ''] ??
            '분석 결과를 안전하게 확인하지 못했습니다. 입력은 유지되니 잠시 후 다시 시도해 주세요.',
        );
        return;
      }
      const parsed = ResultSchema.safeParse(data);
      if (
        !parsed.success ||
        parsed.data.packageId !== id ||
        [
          ...parsed.data.rules,
          ...parsed.data.diagnoses,
          ...parsed.data.priorities,
        ].some(
          (f) =>
            answer.slice(f.evidence.start, f.evidence.end) !== f.evidence.quote,
        )
      )
        throw new Error('Invalid result');
      setResult(parsed.data);
      setSnapshot({ answer });
    } catch {
      if (controller.current === current)
        setNotice(
          current.signal.aborted
            ? '분석 시간이 초과되었습니다. 입력은 유지됩니다.'
            : '분석 서버에 연결하지 못했습니다. 입력은 유지되니 다시 시도해 주세요.',
        );
    } finally {
      clearTimeout(timeout);
      if (controller.current === current) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setNotice('분석을 취소했습니다. 입력은 유지됩니다.');
  }
  return (
    <main className="workspace">
      <a className="skip-link" href="#answer-input">
        답안 입력으로 바로가기
      </a>
      <header className="masthead">
        <span className="brand">
          <BookOpen aria-hidden="true" />
          논술코치<span className="brand-en">nonsul coach</span>
        </span>
        <span className="edition">성신여자대학교 · 인문계열</span>
      </header>
      <section className="intro">
        <p className="eyebrow">나의 생각을 더 단단하게</p>
        <h1>내 글의 논리를 살펴보세요.</h1>
        <p>대학의 공식 기준을 따라, 근거를 찾고 스스로 고치는 논술 연습.</p>
      </section>
      <div className="work-grid">
        <section className="panel" aria-labelledby="input-title">
          <div className="form-title">
            <span className="step-number" aria-hidden="true">
              01
            </span>
            <h2 id="input-title">문제와 내 답안</h2>
            <Button
              className="top-submit"
              form="essay-form"
              type="submit"
              size="sm"
              disabled={!ready || busy}
            >
              {result ? '재분석하기' : '분석하기'}
            </Button>
          </div>
          <form
            id="essay-form"
            onSubmit={submit}
            autoComplete="off"
            aria-busy={!ready || busy}
          >
            <fieldset
              disabled={!ready || busy}
              style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
            >
              <div className="selection-row">
                <div className="field">
                  <Label htmlFor="university">목표 대학교</Label>
                  <NativeSelect
                    id="university"
                    value="sungshin"
                    onChange={() => {}}
                  >
                    <NativeSelectOption value="sungshin">
                      성신여자대학교
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className="field">
                  <Label htmlFor="question">기출 연도·문항</Label>
                  <NativeSelect
                    id="question"
                    value={id}
                    onChange={(e) => {
                      setId(e.target.value);
                      setNotice('');
                      setResult(null);
                      setSnapshot(null);
                    }}
                  >
                    <NativeSelectOptGroup label="2026학년도 실제 기출">
                      {choices
                        .filter((c) => c.exam !== 'mock')
                        .map((c) => (
                          <NativeSelectOption key={c.id} value={c.id}>
                            {c.label}
                          </NativeSelectOption>
                        ))}
                    </NativeSelectOptGroup>
                    <NativeSelectOptGroup label="2027학년도 모의논술">
                      {choices
                        .filter((c) => c.exam === 'mock')
                        .map((c) => (
                          <NativeSelectOption key={c.id} value={c.id}>
                            {c.label}
                          </NativeSelectOption>
                        ))}
                    </NativeSelectOptGroup>
                  </NativeSelect>
                </div>
              </div>
              <OfficialMaterial
                exam={selected.exam}
                questionIndex={selected.questionIndex}
              />
              <div className="field">
                <div className="field-heading">
                  <Label htmlFor="answer-input">학생 답안</Label>
                  <span className="character-count">
                    {count.toLocaleString('ko-KR')}자{' '}
                    <span aria-hidden="true">/</span> 요구 분량 800~1,000자
                  </span>
                </div>
                <Textarea
                  ref={answerRef}
                  id="answer-input"
                  className="answer"
                  required
                  maxLength={6000}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="직접 작성한 답안을 입력해 주세요. 완벽하지 않아도 괜찮습니다. 주장과 근거를 내 언어로 풀어 보세요."
                  aria-describedby="privacy-note count-note"
                  spellCheck={false}
                />
                <p className="hint" id="count-note">
                  공백 포함·줄바꿈 제외 참고값입니다. 원고지 글자 수와 다를 수
                  있습니다.
                </p>
              </div>
              <p className="privacy" id="privacy-note">
                <ShieldCheck aria-hidden="true" />
                <span>
                  이름, 학교명, 연락처 등 개인정보는 입력하지 마세요. 입력한
                  답안은 피드백 생성에만 사용됩니다.
                </span>
              </p>
              <div className="submit-row">
                <p className="hint">새로고침하면 입력과 결과가 사라집니다.</p>
                <Button type="submit">
                  {busy ? (
                    <>
                      <LoaderCircle
                        className="loading-icon"
                        aria-hidden="true"
                      />
                      근거 확인 중…
                    </>
                  ) : (
                    <>
                      {result ? '다시 피드백 받기' : '피드백 받기'}
                      <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </fieldset>
            {busy && (
              <div className="loading-row">
                <output>
                  공식 기준으로 분석하고 답안 근거를 재검증하고 있습니다.
                </output>
                <Button type="button" variant="outline" onClick={cancel}>
                  분석 취소
                </Button>
              </div>
            )}
            {notice && (
              <p className="notice error" role="alert">
                {notice}
              </p>
            )}
            <p className="hint">
              이 앱은 입력·결과를 저장하거나 로그에 남기지 않습니다. 외부 분석은
              제공자의 비저장 설정 확인 후에만 활성화됩니다.
            </p>
            <noscript>답안 입력과 분석에는 JavaScript가 필요합니다.</noscript>
          </form>
        </section>
        <aside className="sidebar" aria-label="평가 기준 안내">
          <section className="panel source-card">
            <p className="source-label">이 문항의 평가 기준</p>
            <h3>
              성신여자대학교
              <br />
              2027 논술 가이드북
            </h3>
            <p className="source-topic">{selected.topic}</p>
            <ul>
              {selected.tasks.map((task) => (
                <li key={task}>{task}</li>
              ))}
            </ul>
            <p className="source-meta">
              공식 가이드북 {selected.pages}쪽<br />
              {selected.label} · 인문계열
            </p>
          </section>
          <section className="process">
            <h3>스스로 고치는 세 단계</h3>
            <ol>
              <li>
                <span>문항 선택과 공식 제시문 확인</span>
              </li>
              <li>
                <span>공식 기준과 답안의 근거 확인</span>
              </li>
              <li>
                <span>우선 과제부터 수정하고 재분석</span>
              </li>
            </ol>
            <p className="hint">
              총점과 합격 가능성을 산출하지 않습니다.
              <br />
              완성 답안을 대신 작성하지 않습니다.
            </p>
          </section>
        </aside>
      </div>
      {result && (
        <FeedbackView
          result={result}
          stale={stale}
          onLocate={(e) => {
            if (!stale) locate(e);
          }}
          onRevise={() => locate()}
        />
      )}
      <footer className="footer">
        성신여자대학교 공식 서비스가 아닌 학생용 프로토타입입니다. · 공식
        가이드북 2027학년도판 / 2026년 발행
      </footer>
    </main>
  );
}
