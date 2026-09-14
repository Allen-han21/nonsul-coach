import content from '@/lib/question-content.json';
import Image from 'next/image';

type ExamKey = 'actual' | 'actual2' | 'mock';

export function OfficialMaterial({
  exam,
  questionIndex,
}: {
  exam: ExamKey;
  questionIndex: number;
}) {
  const selected = content[exam];
  const questionNumber = questionIndex + 1;

  return (
    <section
      className="official-material"
      aria-labelledby="official-material-title"
    >
      <div className="official-material-heading">
        <div>
          <p className="source-label">대학이 제공한 원문</p>
          <h3 id="official-material-title">논술 문제 및 제시문</h3>
        </div>
        <span aria-live="polite">
          {selected.label} · 문제 {questionNumber}
        </span>
      </div>

      <section className="official-question" aria-labelledby="question-title">
        <p id="question-title">문제 {questionNumber}</p>
        <div>{selected.questions[questionIndex]}</div>
      </section>

      <details className="material-disclosure" open>
        <summary>
          <span>유의사항과 제시문</span>
          <span>공식 가이드북 {selected.pageRange}쪽</span>
        </summary>
        <div className="official-paper">
          <section className="exam-notices" aria-labelledby="notices-title">
            <h4 id="notices-title">유의사항</h4>
            <ul>
              {selected.instructions.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </section>

          {selected.instructions.directions.length > 0 && (
            <div className="exam-directions">
              {selected.instructions.directions.map((direction) => (
                <p key={direction}>{direction}</p>
              ))}
            </div>
          )}

          <div className="passages">
            {selected.passages.map((passage) => {
              const paragraphs = passage.text.split('\n\n');
              const hasFigure = selected.figure?.afterPassage === passage.label;
              const body = hasFigure ? paragraphs.slice(0, -1) : paragraphs;

              return (
                <article className="passage" key={passage.label}>
                  <h4>
                    <span>{passage.label}</span>
                    <span className="sr-only">제시문</span>
                  </h4>
                  {body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {hasFigure && selected.figure && (
                    <figure>
                      <figcaption>{selected.figure.caption}</figcaption>
                      <Image
                        src={selected.figure.src}
                        width="1767"
                        height="533"
                        loading="lazy"
                        unoptimized
                        alt="1960년, 2025년, 2072년의 남녀 인구 피라미드와 총인구 및 중위연령을 비교한 인구상황판"
                      />
                    </figure>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </details>
      <p className="hint material-source-note">
        {content.source.title}의 원문입니다. 문장과 표기는 유지하고 줄바꿈만
        화면에 맞게 조정했습니다.
      </p>
    </section>
  );
}
