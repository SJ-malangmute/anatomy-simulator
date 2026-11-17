import * as THREE from 'three';
import { SKIN_R, VEIN_LINES } from '../model/anatomyGeometry';
import { structureName } from '../data/structures';
import type { IncisionSpec } from '../types';

export interface IncisionResult {
  pass: boolean;
  score: number;
  meanDev: number;
  maxDev: number;
  coverage: number;
  damaged: string[];
  feedback: string[];
}

const toDeg = (r: number) => (r * 180) / Math.PI;
const phiOf = (p: THREE.Vector3) => toDeg(Math.atan2(p.x, p.z));
/** 피부 둘레를 따라 잰 거리 (cm) */
const arc = (dPhiDeg: number) => (Math.abs(dPhiDeg) * Math.PI * SKIN_R) / 180;

/** 정맥 곡선의 y별 둘레 각도. 피부 아래 정맥이 절개선과 얼마나 가까운지 판정한다. */
function veinPhiAt(id: string, y: number): number | null {
  const line = VEIN_LINES[id];
  if (!line) return null;
  let best: THREE.Vector3 | null = null;
  let bestDy = Infinity;
  for (const p of line) {
    const dy = Math.abs(p.y - y);
    if (dy < bestDy) {
      bestDy = dy;
      best = p;
    }
  }
  return best && bestDy < 1 ? phiOf(best) : null;
}

const DAMAGE_DISTANCE = 0.55;
const SAMPLE_STEP = 0.3;

/** 빠르게 그어 포인터 이벤트가 듬성듬성해도 판정이 흔들리지 않도록, 피부면을 따라 0.3cm 간격으로 채운다 */
function densify(strokes: THREE.Vector3[][]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  const onSkin = (p: THREE.Vector3) => {
    const r = Math.hypot(p.x, p.z) || 1;
    return new THREE.Vector3((p.x / r) * SKIN_R, p.y, (p.z / r) * SKIN_R);
  };
  for (const stroke of strokes) {
    if (stroke.length === 1) out.push(onSkin(stroke[0]));
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1];
      const b = stroke[i];
      const n = Math.max(1, Math.ceil(a.distanceTo(b) / SAMPLE_STEP));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push(onSkin(a.clone().lerp(b, k / n)));
    }
  }
  return out;
}

export function evaluateIncision(
  strokes: THREE.Vector3[][],
  spec: IncisionSpec,
  preserve: string[],
): IncisionResult {
  const points = densify(strokes);
  const feedback: string[] = [];
  if (points.length < 5) {
    return {
      pass: false,
      score: 0,
      meanDev: 0,
      maxDev: 0,
      coverage: 0,
      damaged: [],
      feedback: ['절개선이 너무 짧습니다. 메스 도구로 피부 위를 길게 그어 주세요.'],
    };
  }

  const yMin = Math.min(spec.yFrom, spec.yTo);
  const yMax = Math.max(spec.yFrom, spec.yTo);
  const devs = points.map((p) => arc(phiOf(p) - spec.phiDeg));
  const inRange = points.map((p, i) => ({ p, d: devs[i] })).filter(({ p }) => p.y >= yMin - 1 && p.y <= yMax + 1);
  const meanDev = inRange.length ? inRange.reduce((a, b) => a + b.d, 0) / inRange.length : Infinity;
  const maxDev = Math.max(...devs);

  // 정답 구간을 1cm 칸으로 나눠, 허용 범위 안에서 지나간 칸의 비율
  const bins = Math.round(yMax - yMin);
  const covered = new Set<number>();
  inRange.forEach(({ p, d }) => {
    if (d <= spec.tolerance * 2) covered.add(Math.floor(p.y - yMin));
  });
  const coverage = Math.min(1, covered.size / bins);

  const damaged = preserve.filter((id) =>
    points.some((p) => {
      const vPhi = veinPhiAt(id, p.y);
      return vPhi !== null && arc(phiOf(p) - vPhi) < DAMAGE_DISTANCE;
    }),
  );

  if (coverage < spec.minCoverage) {
    feedback.push(
      `정답 구간의 ${Math.round(coverage * 100)}%만 절개했습니다. 어깨 쪽부터 팔꿈치 쪽까지 끝까지 그어 주세요.`,
    );
  }
  if (meanDev > spec.tolerance) {
    feedback.push(`정중선에서 평균 ${meanDev.toFixed(1)}cm 벗어났습니다 (허용 ${spec.tolerance}cm).`);
  }
  damaged.forEach((id) =>
    feedback.push(`${structureName(id)} 바로 위를 절개해 손상시켰습니다. 정맥 주행을 피해 정중선을 지키세요.`),
  );

  const pass = coverage >= spec.minCoverage && meanDev <= spec.tolerance;
  if (pass && damaged.length === 0) feedback.push('정확한 절개입니다.');
  else if (pass) feedback.push('절개 위치는 통과했지만 손상 기록이 남습니다.');

  const score = Math.max(
    0,
    Math.round(100 * coverage - Math.max(0, meanDev - 0.3) * 25 - damaged.length * 20),
  );

  return { pass, score, meanDev, maxDev, coverage, damaged, feedback };
}
