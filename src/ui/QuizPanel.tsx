import { useEffect, useRef, useState } from 'react';
import { STRUCTURE_BY_ID, structureName } from '../data/structures';
import { useStore } from '../store';

function Setup() {
  const startQuiz = useStore((s) => s.startQuiz);
  const [count, setCount] = useState(10);
  const [sec, setSec] = useState(30);
  return (
    <div className="card">
      <h3>땡시 연습</h3>
      <p>
        핀이 꽂힌 구조물의 이름을 맞히거나, 근육의 지배신경을 고릅니다. 한글 용어, 구용어, 영어, 라틴어 모두
        정답으로 인정합니다.
      </p>
      <label className="field">
        문항 수
        <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[5, 10, 15].map((n) => (
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
      <button className="btn primary" onClick={() => startQuiz(count, sec)}>
        시작
      </button>
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
        {quiz.answers.map((a, i) => (
          <li key={i} className={a.correct ? 'good' : 'bad'}>
            <span>
              {a.question.kind === 'relation' ? `${structureName(a.question.targetId)}의 지배신경` : '핀'}:{' '}
              <strong>{structureName(a.question.answerId)}</strong>
            </span>
            {!a.correct && (
              <span className="muted small">
                {' '}
                · 내 답: {a.timedOut ? '시간 초과' : a.question.kind === 'relation' ? structureName(a.given) : a.given || '모름'}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="row">
        <button className="btn primary" onClick={() => startQuiz(quiz.questions.length, quiz.perQuestionSec)}>
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
  const answer = STRUCTURE_BY_ID[q.answerId];

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

      {q.kind === 'name' ? (
        <>
          <p>
            <strong>{quiz.index + 1}번 핀</strong>이 가리키는 구조물의 이름은?
          </p>
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
              placeholder="예: 위팔두갈래근 / biceps brachii"
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
        <>
          <p>
            <strong>{quiz.index + 1}번 핀</strong>이 가리키는 근육을 지배하는 신경은?
          </p>
          <div className="choices">
            {q.choices!.map((c) => (
              <button
                key={c}
                className={`btn ${fb && c === q.answerId ? 'good-btn' : ''} ${fb && fb.given === c && !fb.correct ? 'bad-btn' : ''}`}
                onClick={() => answerQuiz(c)}
                disabled={!!fb}
              >
                {structureName(c)}
              </button>
            ))}
          </div>
        </>
      )}

      {fb && (
        <div className={`feedback ${fb.correct ? 'good-card' : 'bad-card'}`}>
          <strong>{fb.correct ? '정답' : fb.timedOut ? '시간 초과' : fb.partial ? '갈래까지 답하세요' : '오답'}</strong>
          <span>
            {' '}
            · {answer.ko} ({answer.la})
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
  return (
    <div className="panel">
      {!quiz ? <Setup /> : quiz.finished ? <Results /> : <Question />}
    </div>
  );
}
