import { create } from 'zustand';
import * as THREE from 'three';
import type { LayerId, RegionId, Scenario, SceneState, Structure, Vec3, Visibility } from './types';
import { ALL_SHOWN, LAYERS, layerIndex } from './data/layers';
import { GROUPS, STRUCTURE_BY_ID, matchesTarget, structureName, structuresIn } from './data/structures';
import { REGION_BY_ID } from './data/regions';
import anteriorArm from './data/scenarios/anterior-arm.json';
import posteriorArm from './data/scenarios/posterior-arm.json';
import anteriorForearm from './data/scenarios/anterior-forearm.json';
import { evaluateIncision, type IncisionResult } from './lib/incision';
import { regionGeometry } from './model/anatomyGeometry';

// ---------- 시나리오 ----------
export const SCENARIOS = [anteriorArm, posteriorArm, anteriorForearm] as Scenario[];
const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export const scenarioById = (id: string) => SCENARIO_BY_ID[id] ?? SCENARIOS[0];
export const scenariosIn = (region: RegionId) => SCENARIOS.filter((s) => s.regionId === region);
export const useScenario = () => useStore((s) => scenarioById(s.scenarioId));

/** 피부를 가르는 둘레 각도. 피부판은 이 선에서 갈라지고 반대편이 경첩이 된다. */
export const incisionPhi = (scenario: Scenario) => {
  const step = scenario.steps.find((s) => s.type === 'incision');
  return step?.type === 'incision' ? step.incision.phiDeg : 0;
};
const VIEW_PHI: Record<Scenario['view'], number> = { anterior: 0, posterior: 180 };

// ---------- 땡시 ----------
export type Mode = 'explore' | 'dissect' | 'quiz';
export type Tool = 'orbit' | 'scalpel';
export type QuizKind = 'name' | 'relation' | 'origin' | 'action' | 'injury';

export const QUIZ_KINDS: { id: QuizKind; label: string }[] = [
  { id: 'name', label: '이름 (핀)' },
  { id: 'relation', label: '지배신경' },
  { id: 'origin', label: '기시' },
  { id: 'action', label: '작용' },
  { id: 'injury', label: '신경 손상 증상' },
];

export interface QuizQuestion {
  kind: QuizKind;
  /** 핀을 꽂을 구조물 (injury 문제는 핀 없음) */
  targetId: string;
  /** 정답: name·relation·injury는 구조물 id, origin·action은 보기 문장 */
  answer: string;
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
  kinds: QuizKind[];
  deadline: number;
  feedback: QuizAnswer | null;
  finished: boolean;
}

export const hasPin = (q: QuizQuestion) => q.kind !== 'injury';

interface Message {
  text: string;
  tone: 'info' | 'good' | 'bad';
  at: number;
}

interface State {
  region: RegionId;
  mode: Mode;
  layerVis: Record<LayerId, Visibility>;
  skinOpen: boolean;
  retracted: Record<string, Vec3>;
  selected: string | null;
  hovered: string | null;
  tool: Tool;
  showGuide: boolean;
  message: Message | null;
  /**
   * 카메라를 이 각도(0 = 앞, 180 = 뒤)로 돌려 달라는 요청. nonce가 바뀔 때마다 적용된다.
   * targetY·distance가 있으면 그 높이를 바라보며 그 거리까지 다가간다 (구조물에 초점 맞추기).
   */
  cameraRequest: { phi: number; nonce: number; targetY?: number; distance?: number } | null;
  /** 구조물별 불투명도 (0 = 숨김, 1 = 기본). 땡시에서는 쓰지 않는다. */
  opacity: Record<string, number>;
  /** 선택한 구조물만 보기 */
  isolated: boolean;

  // 해부 실습
  scenarioId: string;
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

  setRegion: (r: RegionId) => void;
  setMode: (m: Mode) => void;
  setLayer: (id: LayerId, v: Visibility) => void;
  peelOne: () => void;
  coverAll: () => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setTool: (t: Tool) => void;
  toggleGuide: () => void;
  say: (text: string, tone?: Message['tone']) => void;
  lookFrom: (phi: number) => void;
  /** 구조물을 선택하고 카메라를 그 구조물로 돌린다 (숨겨진 층이면 다시 보이게 한다) */
  focusOn: (id: string) => void;
  setOpacity: (id: string, value: number) => void;
  resetOpacity: () => void;
  setIsolated: (on: boolean) => void;

  startDissection: (scenarioId?: string) => void;
  nextStep: () => void;
  beginStroke: (p: THREE.Vector3) => void;
  extendStroke: (p: THREE.Vector3) => void;
  endStroke: () => void;
  clearStrokes: () => void;
  submitIncision: () => void;
  performAction: () => void;
  handleStructureClick: (id: string) => void;

  startQuiz: (count: number, perQuestionSec: number, kinds: QuizKind[]) => void;
  answerQuiz: (given: string, timedOut?: boolean) => void;
  nextQuestion: () => void;
  resetQuiz: () => void;
}

const sceneToState = (scene: SceneState) => ({
  layerVis: { ...ALL_SHOWN, ...scene.layers },
  skinOpen: scene.skinOpen,
  retracted: { ...scene.retracted },
});

const shuffle = <T,>(a: T[]) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** 부위별 문제 대상 */
const poolFor = (region: RegionId) => {
  const all = structuresIn(region);
  return {
    names: all.filter((s) => !['skin', 'tissue', 'fascia'].includes(s.kind)),
    muscles: all.filter((s) => s.kind === 'muscle'),
    injuryNerves: all.filter((s) => s.kind === 'nerve' && s.injury).map((s) => s.id),
    nerveChoices: REGION_BY_ID[region].nerveChoices,
  };
};

/** 괄호 설명과 '끝'을 뺀 핵심 문장 */
const core = (t: string) => t.replace(/\(.*?\)/g, '').replace(/\s*끝\b/g, '').trim();
const items = (t: string) => core(t).split(/[,/]/).map((x) => x.trim()).filter(Boolean);
/** 정답과 사실상 같은 내용이라 함께 보기로 내면 정답이 둘이 되는 문장 */
function tooSimilar(a: string, b: string) {
  const ca = core(a);
  const cb = core(b);
  if (ca === cb || ca.includes(cb) || cb.includes(ca)) return true;
  const shared = items(a).filter((x) => items(b).includes(x)).length;
  return shared >= 2;
}

/** 같은 부위·같은 항목(기시·작용)의 다른 근육 문장으로 오답 보기 3개를 만든다. 정답과 겹치는 문장은 뺀다. */
function textChoices(muscles: Structure[], answer: string, field: 'origin' | 'action') {
  const others = [...new Set(muscles.map((m) => m[field]).filter((t): t is string => !!t && !tooSimilar(t, answer)))];
  const picked: string[] = [];
  for (const t of shuffle(others)) {
    if (picked.length === 3) break;
    if (!picked.some((p) => tooSimilar(p, t))) picked.push(t);
  }
  return shuffle([answer, ...picked]);
}

/** 문제 유형마다 낼 수 있는 대상 */
const CANDIDATES: Record<QuizKind, (region: RegionId) => QuizQuestion[]> = {
  name: (r) => poolFor(r).names.map((s) => ({ kind: 'name', targetId: s.id, answer: s.id })),
  relation: (r) => {
    const { muscles, nerveChoices } = poolFor(r);
    return muscles
      .filter((s) => s.innervation && nerveChoices.includes(s.innervation))
      .map((s) => ({ kind: 'relation', targetId: s.id, answer: s.innervation!, choices: shuffle(nerveChoices) }));
  },
  origin: (r) => {
    const { muscles } = poolFor(r);
    return muscles
      .filter((s) => s.origin)
      .map((s) => ({ kind: 'origin', targetId: s.id, answer: s.origin!, choices: textChoices(muscles, s.origin!, 'origin') }));
  },
  action: (r) => {
    const { muscles } = poolFor(r);
    return muscles
      .filter((s) => s.action)
      .map((s) => ({ kind: 'action', targetId: s.id, answer: s.action!, choices: textChoices(muscles, s.action!, 'action') }));
  },
  injury: (r) => {
    const { injuryNerves } = poolFor(r);
    return injuryNerves.map((id) => ({ kind: 'injury', targetId: id, answer: id, choices: shuffle(injuryNerves) }));
  },
};

function makeQuestions(region: RegionId, count: number, kinds: QuizKind[]): QuizQuestion[] {
  // 고른 유형의 모든 문제를 한 더미로 섞어 앞에서부터 낸다. 더미를 다 쓰기 전에는 같은 문제가 반복되지 않는다.
  const pool = () => shuffle(kinds.flatMap((k) => CANDIDATES[k](region)));
  const out: QuizQuestion[] = [];
  let deck = pool();
  if (!deck.length) return [];
  while (out.length < count) {
    if (!deck.length) deck = pool();
    out.push(deck.pop()!);
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
const layersForQuestion = (q: QuizQuestion) => (hasPin(q) ? layersForTarget(q.targetId) : { ...ALL_SHOWN });

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

/**
 * 구조물 검색: 한글·구용어·영어·라틴어 이름에서 찾는다 (띄어쓰기·m./n. 접두어 무시).
 * 이름이 검색어와 같으면 먼저, 검색어로 시작하면 그다음, 포함하면 마지막.
 */
export function searchStructures(region: RegionId, query: string, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const scored: { s: Structure; score: number }[] = [];
  for (const s of structuresIn(region)) {
    const names = [s.ko, s.en, s.la, ...(s.aliases ?? [])].map(normalize);
    const score = names.some((n) => n === q) ? 0 : names.some((n) => n.startsWith(q)) ? 1 : names.some((n) => n.includes(q)) ? 2 : -1;
    if (score >= 0) scored.push({ s, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.s.ko.length - b.s.ko.length).slice(0, limit).map((x) => x.s);
}

/** 갈래 문제에 근육 이름만 답했는지 */
export function isGroupNameOnly(given: string, id: string) {
  const group = STRUCTURE_BY_ID[id]?.group;
  if (!group) return false;
  const gr = GROUPS[group];
  const g = normalize(given);
  return !!g && [gr.ko, gr.en, gr.la, ...gr.aliases].some((n) => normalize(n) === g);
}

let cameraNonce = 0;

export const useStore = create<State>((set, get) => ({
  region: 'arm',
  mode: 'explore',
  layerVis: { ...ALL_SHOWN },
  skinOpen: false,
  retracted: {},
  selected: null,
  hovered: null,
  tool: 'orbit',
  showGuide: true,
  message: null,
  cameraRequest: null,
  opacity: {},
  isolated: false,

  scenarioId: SCENARIOS[0].id,
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

  setRegion: (r) => {
    if (r === get().region) return;
    set({ region: r, scenarioId: scenariosIn(r)[0]?.id ?? SCENARIOS[0].id, hovered: null, opacity: {} });
    // 같은 모드를 새 부위로 다시 시작하고, 카메라를 정면으로 돌린다
    get().setMode(get().mode);
    get().lookFrom(0);
  },
  setMode: (m) => {
    set({
      mode: m,
      layerVis: { ...ALL_SHOWN },
      skinOpen: false,
      retracted: {},
      selected: null,
      isolated: false,
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
  // 선택이 바뀌면 "이 구조만 보기"는 풀린다
  select: (id) => set((s) => ({ selected: id, isolated: id && id === s.selected ? s.isolated : false })),
  hover: (id) => set({ hovered: id }),
  setTool: (t) => set({ tool: t }),
  toggleGuide: () => set((s) => ({ showGuide: !s.showGuide })),
  say: (text, tone = 'info') => set({ message: { text, tone, at: Date.now() } }),
  lookFrom: (phi) => set({ cameraRequest: { phi, nonce: ++cameraNonce } }),
  focusOn: (id) => {
    const s = STRUCTURE_BY_ID[id];
    if (!s) return;
    const { layerVis, opacity, retracted } = get();
    const pin = regionGeometry(get().region).pins[id];
    set({
      selected: id,
      isolated: false,
      layerVis: layerVis[s.layer] === 'hide' ? { ...layerVis, [s.layer]: 'show' } : layerVis,
      opacity: opacity[id] === 0 ? { ...opacity, [id]: 1 } : opacity,
    });
    if (!pin) return;
    const off = retracted[id] ?? (s.group ? retracted[s.group] : undefined) ?? [0, 0, 0];
    const x = pin.x + off[0];
    const z = pin.z + off[2];
    const phi = Math.hypot(x, z) < 0.5 ? 0 : (Math.atan2(x, z) * 180) / Math.PI;
    set({ cameraRequest: { phi, nonce: ++cameraNonce, targetY: pin.y + off[1], distance: 30 } });
  },
  setOpacity: (id, value) => set((s) => ({ opacity: { ...s.opacity, [id]: Math.max(0, Math.min(1, value)) } })),
  resetOpacity: () => set({ opacity: {}, isolated: false }),
  setIsolated: (on) => set({ isolated: on }),

  startDissection: (scenarioId) => {
    const region = get().region;
    const requested = scenarioById(scenarioId ?? get().scenarioId);
    const scenario = requested.regionId === region ? requested : scenariosIn(region)[0] ?? requested;
    set({
      ...sceneToState(scenario.steps[0].scene),
      scenarioId: scenario.id,
      stepIndex: 0,
      strokes: [],
      incision: null,
      actionDone: false,
      found: [],
      damages: [],
      wrongClicks: 0,
      incisionScore: null,
      selected: null,
      tool: scenario.steps[0].type === 'incision' ? 'scalpel' : 'orbit',
      startedAt: Date.now(),
      finishedAt: null,
    });
    get().lookFrom(VIEW_PHI[scenario.view]);
  },
  nextStep: () => {
    const scenario = scenarioById(get().scenarioId);
    const i = get().stepIndex + 1;
    if (i >= scenario.steps.length) {
      set({ finishedAt: Date.now(), selected: null });
      return;
    }
    const step = scenario.steps[i];
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
    const step = scenarioById(get().scenarioId).steps[get().stepIndex];
    if (step.type !== 'incision') return;
    const result = evaluateIncision(get().strokes, step.incision, step.preserve, regionGeometry(get().region));
    const damages = Array.from(new Set([...get().damages, ...result.damaged]));
    set({ incision: result, damages, incisionScore: result.pass ? result.score : get().incisionScore });
    if (result.damaged.length) get().say(`손상: ${result.damaged.map(structureName).join(', ')}`, 'bad');
  },
  performAction: () => {
    const step = scenarioById(get().scenarioId).steps[get().stepIndex];
    if (step.type !== 'action') return;
    if (step.effect === 'openSkin') set({ skinOpen: true });
    if (step.effect === 'retract' && step.retract) {
      const add = Object.fromEntries(step.retract.map((r) => [r.target, r.offset]));
      set((s) => ({ retracted: { ...s.retracted, ...add } }));
    }
    if (step.effect === 'removeSubcutAndFascia')
      set((s) => ({ layerVis: { ...s.layerVis, subcut: 'hide', fascia: 'hide' } }));
    set({ actionDone: true });
  },
  handleStructureClick: (id) => {
    const { mode, stepIndex, found, finishedAt, scenarioId } = get();
    if (mode === 'explore') {
      set({ selected: id });
      return;
    }
    if (mode !== 'dissect' || finishedAt) return;
    const step = scenarioById(scenarioId).steps[stepIndex];
    if (step.type !== 'identify') {
      set({ selected: id });
      return;
    }
    // 젖혀 둔 피부판은 배경이므로 오답으로 세지 않는다
    if (id === 'skin') return;
    // 시나리오가 근육 단위(예: 위팔두갈래근)로 찾게 할 때는 어느 갈래를 눌러도 그 근육을 찾은 것으로 본다
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

  startQuiz: (count, perQuestionSec, kinds) => {
    const questions = makeQuestions(get().region, count, kinds);
    if (!questions.length) return;
    set({
      quiz: {
        questions,
        index: 0,
        answers: [],
        perQuestionSec,
        kinds,
        deadline: Date.now() + perQuestionSec * 1000,
        feedback: null,
        finished: false,
      },
      layerVis: layersForQuestion(questions[0]),
      skinOpen: false,
      retracted: {},
      selected: null,
    });
  },
  answerQuiz: (given, timedOut = false) => {
    const quiz = get().quiz;
    if (!quiz || quiz.feedback) return;
    const q = quiz.questions[quiz.index];
    const correct = !timedOut && (q.kind === 'name' ? isCorrectName(given, q.answer) : given === q.answer);
    const partial = !correct && !timedOut && q.kind === 'name' && isGroupNameOnly(given, q.answer);
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
      layerVis: layersForQuestion(quiz.questions[index]),
    });
  },
  resetQuiz: () => set({ quiz: null, layerVis: { ...ALL_SHOWN } }),
}));
