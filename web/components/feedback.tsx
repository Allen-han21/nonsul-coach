import { Button } from '@/components/ui/button';
import type { AnalysisResult, Evidence, Feedback } from '@/lib/schema';
function position(evidence: Evidence) {
  return evidence.scope === 'whole_answer'
    ? `답안 전체 · 1~${evidence.paragraphEnd}문단 검토`
    : `${evidence.paragraphStart}${evidence.paragraphStart !== evidence.paragraphEnd ? `~${evidence.paragraphEnd}` : ''}문단 · 원문 위치 ${evidence.start + 1}~${evidence.end}`;
}
function Status({ item }: { item: Feedback }) {
  return (
    <span className="status-badge" data-status={item.status}>
      {item.status}
    </span>
  );
}
function Detail({
  item,
  onLocate,
  stale,
}: {
  item: Feedback;
  onLocate: (e: Evidence) => void;
  stale: boolean;
}) {
  return (
    <div className="feedback-detail">
      <p>{item.reason}</p>
      <div className="evidence">
        <p className="evidence-label">
          분석 당시 답안 근거 · {position(item.evidence)}
        </p>
        <blockquote>{item.evidence.quote}</blockquote>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onLocate(item.evidence)}
          disabled={stale}
        >
          입력란에서 근거 선택
        </Button>
      </div>
      <dl>
        <dt>스스로 묻기</dt>
        <dd>{item.question}</dd>
        <dt>수정 행동</dt>
        <dd>{item.action}</dd>
      </dl>
      <details className="source-detail">
        <summary>공식 근거 · {item.source.page}쪽</summary>
        <p>
          {item.source.document} · {item.source.page}쪽
        </p>
        <q>{item.source.quote}</q>
        <p className="hint">출처 버전: {item.source.version}</p>
      </details>
    </div>
  );
}
export function FeedbackView({
  result,
  stale,
  onLocate,
  onRevise,
}: {
  result: AnalysisResult;
  stale: boolean;
  onLocate: (e: Evidence) => void;
  onRevise: () => void;
}) {
  return (
    <section className="feedback-section" aria-labelledby="feedback-title">
      <div className="feedback-heading">
        <div className="form-title">
          <span className="step-number" aria-hidden="true">
            02
          </span>
          <h2 id="feedback-title" tabIndex={-1}>
            내 답안의 피드백
          </h2>
        </div>
        <span className="hint">총점·등급을 산출하지 않습니다</span>
      </div>
      {stale && (
        <output className="notice stale-notice">
          입력이 수정되었습니다. 아래는 수정 전 답안의 결과입니다. 다시 피드백을
          받아 새 답안을 확인하세요.
        </output>
      )}
      {result.notices.map((n) => (
        <p className="hint" key={n}>
          {n}
        </p>
      ))}
      <section
        className="panel feedback-block"
        aria-labelledby="requirements-title"
      >
        <h3 id="requirements-title">필수 요구사항 검사</h3>
        <p className="hint">
          규칙 검사는 분량·표현 단서를 확인합니다. 내용의 충족 여부는 기준별
          진단과 함께 보세요.
        </p>
        {result.rules.map((item) => (
          <details key={item.id} className="diagnosis">
            <summary>
              <span>{item.label}</span>
              <Status item={item} />
            </summary>
            <Detail item={item} onLocate={onLocate} stale={stale} />
          </details>
        ))}
      </section>
      <section
        className="panel feedback-block"
        aria-labelledby="criteria-title"
      >
        <h3 id="criteria-title">대학 채점 기준별 진단</h3>
        {result.diagnoses.map((item) => (
          <details key={item.id} className="diagnosis">
            <summary>
              <span>{item.label}</span>
              <Status item={item} />
            </summary>
            <Detail item={item} onLocate={onLocate} stale={stale} />
          </details>
        ))}
      </section>
      <section className="priority-section" aria-labelledby="priorities-title">
        <p className="eyebrow">한 번에, 가장 중요한 것부터</p>
        <h3 id="priorities-title">먼저 고칠 {result.priorities.length}가지</h3>
        {!result.priorities.length && (
          <p className="notice">
            검증된 우선 수정 항목이 없습니다. 모든 기준을 충족했다는 뜻은
            아니므로 ‘확인 필요’ 항목도 직접 살펴보세요.
          </p>
        )}
        <ol className="priorities">
          {result.priorities.map((item, i) => (
            <li className="panel priority-card" key={item.id}>
              <div className="priority-heading">
                <span className="priority-number">{i + 1}</span>
                <h4>{item.label}</h4>
                <Status item={item} />
              </div>
              <Detail item={item} onLocate={onLocate} stale={stale} />
            </li>
          ))}
        </ol>
      </section>
      <div className="revision-bar">
        <div>
          <h3>이제 내 언어로 고쳐 보세요.</h3>
          <p className="hint">
            입력란에서 수정한 뒤 같은 문항으로 다시 분석할 수 있습니다.
          </p>
        </div>
        <Button type="button" onClick={onRevise}>
          답안 수정하러 가기
        </Button>
      </div>
    </section>
  );
}
