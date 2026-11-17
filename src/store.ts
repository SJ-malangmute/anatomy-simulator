import { create } from 'zustand';
import * as THREE from 'three';
import type { LayerId, Scenario, SceneState, Visibility } from './types';
import { ALL_SHOWN, LAYERS, layerIndex } from './data/layers';
import { GROUPS, STRUCTURES, STRUCTURE_BY_ID, matchesTarget, structureName } from './data/structures';
import scenarioJson from './data/scenarios/anterior-arm.json';
import { evaluateIncision, type IncisionResult } from './lib/incision';

export const SCENARIO = scenarioJson as Scenario;

export type Mode = 'explore' | 'dissect' | 'quiz';
export type Tool = 'orbit' | 'scalpel';

export interface QuizQuestion {
  kind: 'name' | 'relation';
  targetId: string;
  answerId: string;
  choices?: string[];
}

export interface QuizAnswer {
  question: QuizQuestion;
  given: string;
  correct: boolean;
  timedOut: boolean;
  /** 근육 이름은 맞았지만 갈래를 빠뜨린 경우 */
  partial?: boolean;
}

export interface QuizState {
  questions: QuizQuestion[];
  index: number;
  answers: QuizAnswer[];
  perQuestionSec: number;
  deadline: number;
  feedback: QuizAnswer | null;
  finished: boolean;
}

interface Message {
  text: string;
  tone: 'info' | 'good' | 'bad';
  at: number;
}

interface State {
  mode: Mode;
  layerVis: Record<LayerId, Visibility>;
  skinOpen: boolean;
  bicepsRetracted: boolean;
  selected: string | null;
  hovered: string | null;
  tool: Tool;
  showGuide: boolean;
  message: Message | null;

  // 해부 실습
  stepIndex: number;
  strokes: THREE.Vector3[][];
  drawing: boolean;
  incision: IncisionResult | null;
  actionDone: boolean;
  found: string[];
  damages: string[];
  wrongClicks: number;
  incisionScore: number | null;
  startedAt: number;
  finishedAt: number | null;

  // 땡시
  quiz: QuizState | null;

  setMode: (m: Mode) => void;
  setLayer: (id: LayerId, v: Visibility) => void;
  peelOne: () => void;
  coverAll: () => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setTool: (t: Tool) => void;
  toggleGuide: () => void;
  say: (text: string, tone?: Message['tone']) => void;

  startDissection: () => void;
  nextStep: () => void;
  beginStroke: (p: THREE.Vector3) => void;
  extendStroke: (p: THREE.Vector3) => void;
  endStroke: () => void;
  clearStrokes: () => void;
  submitIncision: () => void;
  performAction: () => void;
  handleStructureClick: (id: string) => void;

  startQuiz: (count: number, perQuestionSec: number) => void;
  answerQuiz: (given: string, timedOut?: boolean) => void;
  nextQuestion: () => void;
  resetQuiz: () => void;
}

const sceneToState = (scene: SceneState) => ({
  layerVis: { ...ALL_SHOWN, ...scene.layers },
  skinOpen: scene.skinOpen,
  bicepsRetracted: scene.bicepsRetracted,
});

const shuffle = <T,>(a: T[]) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const NERVE_CHOICES = ['musculocutaneous_nerve', 'radial_nerve', 'median_nerve', 'ulnar_nerve'];
const QUIZ_POOL = STRUCTURES.filter((s) => !['skin', 'subcutaneous', 'brachial_fascia'].includes(s.id));

function makeQuestions(count: number): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  while (out.length < count) {
    for (const s of shuffle(QUIZ_POOL)) {
      if (out.length >= count) break;
      if (s.kind === 'muscle' && s.innervation && Math.random() < 0.35) {
        out.push({ kind: 'relation', targetId: s.id, answerId: s.innervation, choices: shuffle(NERVE_CHOICES) });
      } else {
        out.push({ kind: 'name', targetId: s.id, answerId: s.id });
      }
    }
  }
  return out;
}

/** 땡시 문제의 구조물이 보이도록 층을 정한다 */
export function layersForTarget(id: string): Record<LayerId, Visibility> {
  const target = layerIndex(STRUCTURE_BY_ID[id].layer);
  const out = { ...ALL_SHOWN };
  LAYERS.forEach((l, i) => {
    if (i < target) out[l.id] = l.id === 'muscle' || l.id === 'neurovascular' ? 'ghost' : 'hide';
  });
  return out;
}

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^(musculus|nervus|arteria|vena|m|n|a|v)\.?\s+/, '')
    .replace(/[\s.\-·,()]/g, '');

export function isCorrectName(given: string, id: string) {
  const s = STRUCTURE_BY_ID[id];
  const g = normalize(given);
  if (!g) return false;
  return [s.ko, s.en, s.la, ...(s.aliases ?? [])].some((n) => normalize(n) === g);
}

/** 갈래 문제에 근육 이름만 답했는지 */
export function isGroupNameOnly(given: string, id: string) {
  const group = STRUCTURE_BY_ID[id]?.group;
  if (!group) return false;
  const gr = GROUPS[group];
  const g = normalize(given);
  return !!g && [gr.ko, gr.en, gr.la, ...gr.aliases].some((n) => normalize(n) === g);
}

export const useStore = create<State>((set, get) => ({
  mode: 'explore',
  layerVis: { ...ALL_SHOWN },
  skinOpen: false,
  bicepsRetracted: false,
  selected: null,
  hovered: null,
  tool: 'orbit',
  showGuide: true,
  message: null,

  stepIndex: 0,
  strokes: [],
  drawing: false,
  incision: null,
  actionDone: false,
  found: [],
  damages: [],
  wrongClicks: 0,
  incisionScore: null,
  startedAt: Date.now(),
  finishedAt: null,

  quiz: null,

  setMode: (m) => {
    set({
      mode: m,
      layerVis: { ...ALL_SHOWN },
      skinOpen: false,
      bicepsRetracted: false,
      selected: null,
      tool: 'orbit',
      quiz: null,
      message: null,
    });
    if (m === 'dissect') get().startDissection();
  },
  setLayer: (id, v) => set((s) => ({ layerVis: { ...s.layerVis, [id]: v } })),
  peelOne: () => {
    const vis = get().layerVis;
    const outer = LAYERS.find((l) => vis[l.id] !== 'hide' && l.id !== 'bone');
    if (outer) set({ layerVis: { ...vis, [outer.id]: 'hide' } });
  },
  coverAll: () => set({ layerVis: { ...ALL_SHOWN } }),
  select: (id) => set({ selected: id }),
  hover: (id) => set({ hovered: id }),
  setTool: (t) => set({ tool: t }),
  toggleGuide: () => set((s) => ({ showGuide: !s.showGuide })),
  say: (text, tone = 'info') => set({ message: { text, tone, at: Date.now() } }),

  startDissection: () =>
    set({
      ...sceneToState(SCENARIO.steps[0].scene),
      stepIndex: 0,
      strokes: [],
      incision: null,
      actionDone: false,
      found: [],
      damages: [],
      wrongClicks: 0,
      incisionScore: null,
      selected: null,
      tool: 'scalpel',
      startedAt: Date.now(),
      finishedAt: null,
    }),
  nextStep: () => {
    const i = get().stepIndex + 1;
    if (i >= SCENARIO.steps.length) {
      set({ finishedAt: Date.now(), selected: null });
      return;
    }
    const step = SCENARIO.steps[i];
    set({
      ...sceneToState(step.scene),
      stepIndex: i,
      actionDone: false,
      found: [],
      selected: null,
      tool: step.type === 'incision' ? 'scalpel' : 'orbit',
    });
  },
  beginStroke: (p) => set((s) => ({ drawing: true, strokes: [...s.strokes, [p.clone()]] })),
  extendStroke: (p) => {
    const { drawing, strokes } = get();
    if (!drawing || strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    if (last[last.length - 1].distanceTo(p) < 0.15) return;
    set({ strokes: [...strokes.slice(0, -1), [...last, p.clone()]] });
  },
  endStroke: () => set({ drawing: false }),
  clearStrokes: () => set({ strokes: [], incision: null }),
  submitIncision: () => {
    const step = SCENARIO.steps[get().stepIndex];
    if (step.type !== 'incision') return;
    const result = evaluateIncision(get().strokes, step.incision, step.preserve);
    const damages = Array.from(new Set([...get().damages, ...result.damaged]));
    set({ incision: result, damages, incisionScore: result.pass ? result.score : get().incisionScore });
    if (result.damaged.length) get().say(`손상: ${result.damaged.map(structureName).join(', ')}`, 'bad');
  },
  performAction: () => {
    const step = SCENARIO.steps[get().stepIndex];
    if (step.type !== 'action') return;
    if (step.effect === 'openSkin') set({ skinOpen: true });
    if (step.effect === 'retractBiceps') set({ bicepsRetracted: true });
    if (step.effect === 'removeSubcutAndFascia')
      set((s) => ({ layerVis: { ...s.layerVis, subcut: 'hide', fascia: 'hide' } }));
    set({ actionDone: true });
  },
  handleStructureClick: (id) => {
    const { mode, stepIndex, found, finishedAt } = get();
    if (mode === 'explore') {
      set({ selected: id });
      return;
    }
    if (mode !== 'dissect' || finishedAt) return;
    const step = SCENARIO.steps[stepIndex];
    if (step.type !== 'identify') {
      set({ selected: id });
      return;
    }
    // 젖혀 둔 피부판은 배경이므로 오답으로 세지 않는다
    if (id === 'skin') return;
    // 시나리오는 근육 단위(예: 위팔두갈래근)로 찾게 하므로, 어느 갈래를 눌러도 그 근육을 찾은 것으로 본다
    const target = step.targets.find((t) => matchesTarget(id, t));
    if (target) {
      if (!found.includes(target)) {
        const next = [...found, target];
        set({ found: next, selected: id });
        const detail = target !== id ? ` (${structureName(id)})` : '';
        get().say(
          next.length === step.targets.length
            ? '모두 찾았습니다. 다음 단계로 넘어가세요.'
            : `정답: ${structureName(target)}${detail}`,
          'good',
        );
      } else {
        set({ selected: id });
      }
    } else {
      set((s) => ({ wrongClicks: s.wrongClicks + 1, selected: id }));
      get().say(`${structureName(id)}은(는) 이번 단계의 찾을 대상이 아닙니다.`, 'bad');
    }
  },

  startQuiz: (count, perQuestionSec) => {
    const questions = makeQuestions(count);
    set({
      quiz: {
        questions,
        index: 0,
        answers: [],
        perQuestionSec,
        deadline: Date.now() + perQuestionSec * 1000,
        feedback: null,
        finished: false,
      },
      layerVis: layersForTarget(questions[0].targetId),
      skinOpen: false,
      bicepsRetracted: false,
      selected: null,
    });
  },
  answerQuiz: (given, timedOut = false) => {
    const quiz = get().quiz;
    if (!quiz || quiz.feedback) return;
    const q = quiz.questions[quiz.index];
    const correct = !timedOut && (q.kind === 'name' ? isCorrectName(given, q.answerId) : given === q.answerId);
    const partial = !correct && !timedOut && q.kind === 'name' && isGroupNameOnly(given, q.answerId);
    const answer: QuizAnswer = { question: q, given, correct, timedOut, partial };
    set({ quiz: { ...quiz, answers: [...quiz.answers, answer], feedback: answer } });
  },
  nextQuestion: () => {
    const quiz = get().quiz;
    if (!quiz) return;
    const index = quiz.index + 1;
    if (index >= quiz.questions.length) {
      set({ quiz: { ...quiz, feedback: null, finished: true }, layerVis: { ...ALL_SHOWN } });
      return;
    }
    set({
      quiz: { ...quiz, index, feedback: null, deadline: Date.now() + quiz.perQuestionSec * 1000 },
      layerVis: layersForTarget(quiz.questions[index].targetId),
    });
  },
  resetQuiz: () => set({ quiz: null, layerVis: { ...ALL_SHOWN } }),
}));
