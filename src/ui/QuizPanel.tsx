import { useEffect, useRef, useState } from 'react';
import { STRUCTURE_BY_ID, structureName } from '../data/structures';
import { QUIZ_KINDS, useStore, type QuizAnswer, type QuizKind, type QuizQuestion } from '../store';

/** 보기·정답이 구조물 id인 유형 */
const ID_ANSWER: QuizKind[] = ['name', 'relation', 'injury'];
const answerLabel = (q: QuizQuestion, value: string) => (ID_ANSWER.includes(q.kind) ? structureName(value) : value);

function prompt(q: QuizQuestion, n: number) {
  const pin = <strong>{n}번 핀</strong>;
  switch (q.kind) {
    case 'name':
      return <>{pin}이 가리키는 구조물의 이름은?</>;
    case 'relation':
      return <>{pin}이 가리키는 근육을 지배하는 신경은?</>;
    case 'origin':
      return <>{pin}이 가리키는 근육의 기시는?</>;
    case 'action':
      return <>{pin}이 가리키는 근육의 작용은?</>;
    case 'injury':
      return <>다음 증상을 일으키는 신경 손상은?</>;
  }
}

/** 결과 목록 한 줄: 무엇을 물었고 정답이 무엇이었는지 */
function reviewLine(a: QuizAnswer) {
  const q = a.question;
  const target = structureName(q.targetId);
  switch (q.kind) {
    case 'name':
      return { asked: '핀', answer: target };
    case 'relation':
      return { asked: `${target}의 지배신경`, answer: structureName(q.answer) };
    case 'origin':
      return { asked: `${target}의 기시`, answer: q.answer };
    case 'action':
      return { asked: `${target}의 작용`, answer: q.answer };
    case 'injury':
      return { asked: '신경 손상 증상', answer: target };
  }
}

function Setup() {
  const startQuiz = useStore((s) => s.startQuiz);
  const [count, setCount] = useState(10);
  const [sec, setSec] = useState(30);
  const [kinds, setKinds] = useState<QuizKind[]>(QUIZ_KINDS.map((k) => k.id));
  const toggle = (k: QuizKind) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

  return (
    <div className="card">
      <h3>땡시 연습</h3>
      <p>
        핀이 꽂힌 구조물의 이름을 맞히거나 보기에서 고릅니다. 이름 문제는 한글 용어, 구용어, 영어, 라틴어 모두 정답으로
        인정합니다.
      </p>
      <fieldset className="kind-list" aria-label="문제 유형">
        {QUIZ_KINDS.map((k) => (
          <label key={k.id} className="check">
            <input type="checkbox" checked={kinds.includes(k.id)} onChange={() => toggle(k.id)} /> {k.label}
          </label>
        ))}
      </fieldset>
      <label className="field">
        문항 수
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[5, 10, 15, 20].map((n) => (
            <option key={n} value={n}>
              {n}문항
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        문항당 시간
        <select value={sec} onChange={(e) => setSec(Number(e.target.value))}>
          {[20, 30, 60].map((n) => (
            <option key={n} value={n}>
              {n}초
            </option>
          ))}
        </select>
      </label>
      <button className="btn primary" onClick={() => startQuiz(count, sec, kinds)} disabled={!kinds.length}>
        시작
      </button>
      {!kinds.length && <p className="bad small">문제 유형을 하나 이상 고르세요.</p>}
    </div>
  );
}

function Results() {
  const quiz = useStore((s) => s.quiz)!;
  const startQuiz = useStore((s) => s.startQuiz);
  const resetQuiz = useStore((s) => s.resetQuiz);
  const correct = quiz.answers.filter((a) => a.correct).length;
  return (
    <div className="card">
      <h3>
        결과: {correct} / {quiz.answers.length}
      </h3>
      <ol className="review">
        {quiz.answers.map((a, i) => {
          const line = reviewLine(a);
          return (
            <li key={i} className={a.correct ? 'good' : 'bad'}>
              <span>
                {line.asked}: <strong>{line.answer}</strong>
              </span>
              {!a.correct && (
                <span className="muted small">
                  {' '}
                  · 내 답:{' '}
                  {a.timedOut ? '시간 초과' : a.given ? answerLabel(a.question, a.given) : '모름'}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="row">
        <button
          className="btn primary"
          onClick={() => startQuiz(quiz.questions.length, quiz.perQuestionSec, quiz.kinds)}
        >
          다시 풀기
        </button>
        <button className="btn" onClick={resetQuiz}>
          설정으로
        </button>
      </div>
    </div>
  );
}

function Question() {
  const quiz = useStore((s) => s.quiz)!;
  const answerQuiz = useStore((s) => s.answerQuiz);
  const nextQuestion = useStore((s) => s.nextQuestion);
  const [text, setText] = useState('');
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const q = quiz.questions[quiz.index];
  const fb = quiz.feedback;

  useEffect(() => {
    setText('');
    inputRef.current?.focus();
  }, [quiz.index]);

  useEffect(() => {
    if (fb) nextRef.current?.focus();
  }, [fb]);

  useEffect(() => {
    if (fb) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= quiz.deadline) answerQuiz('', true);
    }, 200);
    return () => clearInterval(t);
  }, [fb, quiz.deadline, answerQuiz]);

  const remaining = Math.max(0, quiz.deadline - now) / 1000;
  const target = STRUCTURE_BY_ID[q.targetId];
  const textChoices = q.kind === 'origin' || q.kind === 'action';

  return (
    <div className="card">
      <div className="quiz-head">
        <span>
          문항 {quiz.index + 1} / {quiz.questions.length}
        </span>
        <span className={remaining < 6 && !fb ? 'bad' : 'muted'}>{fb ? '' : `${Math.ceil(remaining)}초`}</span>
      </div>
      <div className="timer">
        <div style={{ width: `${fb ? 0 : (remaining / quiz.perQuestionSec) * 100}%` }} />
      </div>

      <p>{prompt(q, quiz.index + 1)}</p>
      {q.kind === 'injury' && <div className="injury-box">{target.injury}</div>}

      {q.kind === 'name' ? (
        <>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              answerQuiz(text);
            }}
          >
            <input
              ref={inputRef}
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 위팔두갈래근 긴갈래 / biceps brachii"
              disabled={!!fb}
              aria-label="정답 입력"
            />
            <button className="btn primary" type="submit" disabled={!!fb}>
              제출
            </button>
          </form>
          {!fb && (
            <button className="btn link" onClick={() => answerQuiz('')}>
              모르겠음
            </button>
          )}
        </>
      ) : (
        <div className={`choices ${textChoices ? 'text' : ''}`}>
          {q.choices!.map((c) => (
            <button
              key={c}
              className={`btn ${fb && c === q.answer ? 'good-btn' : ''} ${fb && fb.given === c && !fb.correct ? 'bad-btn' : ''}`}
              onClick={() => answerQuiz(c)}
              disabled={!!fb}
            >
              {answerLabel(q, c)}
            </button>
          ))}
        </div>
      )}

      {fb && (
        <div className={`feedback ${fb.correct ? 'good-card' : 'bad-card'}`}>
          <strong>{fb.correct ? '정답' : fb.timedOut ? '시간 초과' : fb.partial ? '갈래까지 답하세요' : '오답'}</strong>
          <span>
            {' '}
            ·{' '}
            {textChoices
              ? `${target.ko}: ${q.answer}`
              : `${structureName(q.answer)} (${STRUCTURE_BY_ID[q.answer].la})`}
          </span>
          <button ref={nextRef} className="btn primary" onClick={nextQuestion}>
            {quiz.index + 1 === quiz.questions.length ? '결과 보기' : '다음 문항'}
          </button>
        </div>
      )}
    </div>
  );
}

export function QuizPanel() {
  const quiz = useStore((s) => s.quiz);
  return <div className="panel">{!quiz ? <Setup /> : quiz.finished ? <Results /> : <Question />}</div>;
}
