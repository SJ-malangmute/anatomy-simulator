// BodyParts3D 오른쪽 위팔 구조물을 앱용 glb + 메타데이터로 변환한다.
// 사용법: node scripts/bp3d/build-arm.mjs <extracted 폴더>
//   출력: public/models/arm.glb, src/data/generated/arm-meta.json
//
// 원본 좌표계(mm): x = 오른쪽(-)→왼쪽(+), y = 앞(-)→뒤(+), z = 위(+)
// 앱 좌표계(cm):   x = 안쪽(+), y = 위(+), z = 앞(+)  (오른팔이므로 원본 +x가 안쪽)

import { mkdirSync, writeFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { readObj, findObj } from './obj.mjs';

const extracted = process.argv[2];
if (!extracted) throw new Error('extracted 폴더 경로를 넘겨 주세요');

/** 앱 structure id → BodyParts3D (FMA 개념 ID, OBJ 파일 ID) */
const SOURCES = {
  humerus: [['FMA23130', 'FJ3368']],
  biceps_short_head: [['FMA37684', 'FJ1512']], // short head of right biceps brachii
  biceps_long_head: [['FMA37686', 'FJ1478']], // long head of right biceps brachii
  triceps_long_head: [['FMA37699', 'FJ1479']],
  triceps_lateral_head: [['FMA37697', 'FJ1477']],
  triceps_medial_head: [['FMA37695', 'FJ1480']],
  brachialis: [['FMA37668', 'FJ1486']],
  coracobrachialis: [['FMA37665', 'FJ1488']],
  brachial_artery: [
    ['FMA22691', 'FJ2271'],
    ['FMA22696', 'FJ2277'], // right deep brachial artery (위팔동맥 메시에 함께 둔다)
  ],
  cephalic_vein: [['FMA13325', 'FJ2272']],
  basilic_vein: [['FMA22909', 'FJ2270']],
};

/** 표본으로 잘라낼 높이 범위 (원본 z, mm): 팔꿈치 위 ~ 겨드랑이 아래 */
const Z_LO = 1030;
const Z_HI = 1280;
const Z_MID = (Z_LO + Z_HI) / 2;

/** 갈래들을 묶은 근육 (라벨·핀·신경 배치에 쓴다) */
const GROUPS = {
  biceps_brachii: ['biceps_short_head', 'biceps_long_head'],
  triceps_brachii: ['triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head'],
};
const DEEP = ['humerus', ...GROUPS.biceps_brachii, ...GROUPS.triceps_brachii, 'brachialis', 'coracobrachialis', 'brachial_artery'];
const VEINS = ['cephalic_vein', 'basilic_vein'];

// ---------- 1. 읽기와 자르기 ----------
function loadCropped(fileId) {
  const { positions, indices } = readObj(findObj(extracted, fileId));
  const keep = new Map();
  const out = { positions: [], indices: [] };
  const inside = (i) => positions[i * 3 + 2] >= Z_LO && positions[i * 3 + 2] <= Z_HI;
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    if (!tri.every(inside)) continue;
    for (const i of tri) {
      if (!keep.has(i)) {
        keep.set(i, out.positions.length / 3);
        out.positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      }
      out.indices.push(keep.get(i));
    }
  }
  return out;
}

const raw = {};
for (const [id, list] of Object.entries(SOURCES)) {
  const merged = { positions: [], indices: [] };
  for (const [, fileId] of list) {
    const part = loadCropped(fileId);
    const base = merged.positions.length / 3;
    merged.positions.push(...part.positions);
    merged.indices.push(...part.indices.map((i) => i + base));
  }
  raw[id] = merged;
}

// ---------- 2. 팔 축: 위팔뼈 몸통 중심선을 직선으로 맞춘다 ----------
// 원본 팔은 약 8° 기울어 있어, 위팔뼈 몸통의 높이별 중심을 직선 회귀한 뒤 전단 변환으로 세운다.
const fit = (() => {
  const p = raw.humerus.positions;
  const pts = [];
  for (let z = 1060; z <= 1260; z += 10) {
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 2] - z) < 5) {
        sx += p[i];
        sy += p[i + 1];
        n++;
      }
    }
    if (n) pts.push([z - Z_MID, sx / n, sy / n]);
  }
  const line = (k) => {
    const n = pts.length;
    const mz = pts.reduce((a, q) => a + q[0], 0) / n;
    const mv = pts.reduce((a, q) => a + q[k], 0) / n;
    const slope =
      pts.reduce((a, q) => a + (q[0] - mz) * (q[k] - mv), 0) / pts.reduce((a, q) => a + (q[0] - mz) ** 2, 0);
    return { at0: mv - slope * mz, slope };
  };
  return { x: line(1), y: line(2) };
})();
// 위팔뼈는 팔 단면의 중심보다 약간 뒤·가쪽에 있으므로, 단면 중심 보정을 위해 깊은 구조물의 평균 오프셋을 더한다
let offX = 0, offY = 0, offN = 0;
for (const id of DEEP) {
  const p = raw[id].positions;
  for (let i = 0; i < p.length; i += 3) {
    const dz = p[i + 2] - Z_MID;
    offX += p[i] - (fit.x.at0 + fit.x.slope * dz);
    offY += p[i + 1] - (fit.y.at0 + fit.y.slope * dz);
    offN++;
  }
}
offX /= offN;
offY /= offN;
const axisAt = (z) => [fit.x.at0 + fit.x.slope * (z - Z_MID) + offX, fit.y.at0 + fit.y.slope * (z - Z_MID) + offY];
console.log(
  `axis slope x=${fit.x.slope.toFixed(3)} y=${fit.y.slope.toFixed(3)} (tilt ${((Math.atan(Math.hypot(fit.x.slope, fit.y.slope)) * 180) / Math.PI).toFixed(1)}°), offset ${offX.toFixed(1)},${offY.toFixed(1)} mm`,
);

/** 원본(mm) → 앱(cm). 전단 변환이라 삼각형 방향은 그대로다. */
const toApp = (x, y, z) => {
  const [ax, ay] = axisAt(z);
  return [(x - ax) / 10, (z - Z_MID) / 10, -(y - ay) / 10];
};

const meshes = {};
for (const [id, m] of Object.entries(raw)) {
  const p = [];
  for (let i = 0; i < m.positions.length; i += 3) p.push(...toApp(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
  meshes[id] = { positions: p, indices: m.indices };
  console.log(`${id}: ${p.length / 3} verts, ${m.indices.length / 3} tris`);
}

const HALF = (Z_HI - Z_LO) / 20; // cm
const phiOf = (x, z) => (Math.atan2(x, z) * 180) / Math.PI; // 0 = 앞, + = 안쪽

// ---------- 3. 피부·근막 외피 (깊은 구조물 + 표재정맥을 감싸는 별 모양 껍질) ----------
const ANG = 48;
const ROWS = 41;
const rowY = (j) => -HALF + (2 * HALF * j) / (ROWS - 1);
function radialMax(ids) {
  const grid = Array.from({ length: ROWS }, () => new Array(ANG).fill(0));
  for (const id of ids) {
    const p = meshes[id].positions;
    for (let i = 0; i < p.length; i += 3) {
      const [x, y, z] = [p[i], p[i + 1], p[i + 2]];
      const r = Math.hypot(x, z);
      const j = Math.round(((y + HALF) / (2 * HALF)) * (ROWS - 1));
      const a = Math.round((((phiOf(x, z) + 360) % 360) / 360) * ANG) % ANG;
      for (let dj = -1; dj <= 1; dj++)
        for (let da = -1; da <= 1; da++) {
          const jj = j + dj;
          if (jj < 0 || jj >= ROWS) continue;
          const aa = (a + da + ANG) % ANG;
          grid[jj][aa] = Math.max(grid[jj][aa], r);
        }
    }
  }
  return grid;
}
function fillAndSmooth(grid, minR, passes) {
  let g = grid.map((row) => row.map((r) => Math.max(r, minR)));
  for (let k = 0; k < passes; k++) {
    g = g.map((row, j) =>
      row.map((_, a) => {
        let s = 0;
        let n = 0;
        for (let dj = -1; dj <= 1; dj++)
          for (let da = -1; da <= 1; da++) {
            const jj = Math.min(ROWS - 1, Math.max(0, j + dj));
            s += g[jj][(a + da + ANG) % ANG];
            n++;
          }
        return Math.max(s / n, g[j][a] * 0.97);
      }),
    );
  }
  return g;
}
const deepR = fillAndSmooth(radialMax(DEEP), 2.2, 4);
const veinR = radialMax(VEINS);
const round = (v) => Math.round(v * 1000) / 1000;
// 표재정맥은 근막 바깥(피하조직)에 있어야 하므로, 정맥이 지나는 칸에서는 근막을 정맥 아래로 내린다
const veinNear = fillAndSmooth(
  veinR.map((row) => row.map((r) => (r ? r : 99))),
  0,
  0,
);
const fascia = deepR.map((row, j) =>
  row.map((r, a) => round(Math.max(r - 0.8, Math.min(r + 0.15, veinNear[j][a] - 0.35)))),
);
const skinRaw = fascia.map((row, j) => row.map((r, a) => Math.max(r + 0.75, veinR[j][a] ? veinR[j][a] + 0.35 : 0)));
const skin = fillAndSmooth(skinRaw, 3, 3).map((row) => row.map(round));
const subcut = skin.map((row) => row.map((r) => round(r - 0.3)));
const meanSkinR = skin.flat().reduce((a, b) => a + b, 0) / (ROWS * ANG);

// ---------- 4. 중심선 (정맥 손상 판정·신경 배치용) ----------
function centerline(id, step = 0.5) {
  const p = meshes[id].positions;
  const bins = new Map();
  for (let i = 0; i < p.length; i += 3) {
    const k = Math.round(p[i + 1] / step);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0] += p[i];
    b[1] += p[i + 1];
    b[2] += p[i + 2];
    b[3]++;
    bins.set(k, b);
  }
  return [...bins.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, b]) => [round(b[0] / b[3]), round(b[1] / b[3]), round(b[2] / b[3])]);
}
/** 구조물 id 또는 갈래 묶음 id의 위치 배열 */
const positionsOf = (id) => (GROUPS[id] ? GROUPS[id].flatMap((h) => meshes[h].positions) : meshes[id].positions);

function sliceStats(id, y, band = 0.6) {
  const p = positionsOf(id);
  let sx = 0, sz = 0, n = 0, maxR = 0, minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] - y) > band) continue;
    sx += p[i];
    sz += p[i + 2];
    n++;
    minX = Math.min(minX, p[i]);
    maxX = Math.max(maxX, p[i]);
    maxR = Math.max(maxR, Math.hypot(p[i], p[i + 2]));
  }
  return n ? { cx: sx / n, cz: sz / n, n, minX, maxX, maxR } : null;
}

const arteryLine = centerline('brachial_artery', 0.8).filter((pt) => {
  // 깊은위팔동맥이 섞인 칸을 피하려고 앞쪽(+z)으로 치우친 위팔동맥 칸만 남긴다
  const s = sliceStats('brachial_artery', pt[1], 0.4);
  return s !== null;
});
const lerp = (a, b, t) => a + (b - a) * t;
const ys = Array.from({ length: 25 }, (_, i) => lerp(HALF - 0.3, -HALF + 0.3, i / 24));

function arteryAt(y) {
  // 위팔동맥 본줄기: 같은 높이에서 가장 앞쪽(+z) 덩어리의 중심
  const p = meshes.brachial_artery.positions;
  let best = null;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] - y) > 0.5) continue;
    if (!best || p[i + 2] > best[2]) best = [p[i], p[i + 1], p[i + 2]];
  }
  if (!best) return null;
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] - y) > 0.5) continue;
    if (Math.hypot(p[i] - best[0], p[i + 2] - best[2]) > 0.9) continue;
    sx += p[i];
    sz += p[i + 2];
    n++;
  }
  return [sx / n, y, sz / n];
}

const humerusAt = (y) => sliceStats('humerus', y, 0.5);

const nerves = { median_nerve: [], ulnar_nerve: [], musculocutaneous_nerve: [], radial_nerve: [] };
ys.forEach((y, i) => {
  const t = i / (ys.length - 1); // 0 = 위, 1 = 아래
  const a = arteryAt(y) ?? arteryAt(y + 1) ?? arteryAt(y - 1);
  const h = humerusAt(y);
  if (a) {
    // 정중신경: 위에서는 동맥 가쪽, 가운데에서 앞을 지나, 아래에서는 안쪽
    nerves.median_nerve.push([lerp(-0.55, 0.6, t) + a[0], y, a[2] + 0.35 + 0.35 * Math.sin(Math.PI * t)]);
    // 자신경: 동맥 안쪽에서 시작해 아래로 갈수록 뒤(안쪽위관절융기 뒤)로
    if (h) {
      const target = [h.maxX + 0.4, y, h.cz - 1.0];
      const s = Math.pow(t, 1.3);
      nerves.ulnar_nerve.push([lerp(a[0] + 0.7, target[0], s), y, lerp(a[2] - 0.2, target[2], s)]);
    }
  }
  // 근육피부신경: 위팔두갈래근과 위팔근(위쪽은 부리위팔근) 사이, 가쪽으로
  const b = sliceStats('biceps_brachii', y);
  const deep = sliceStats('brachialis', y) ?? sliceStats('coracobrachialis', y);
  if (b && deep) nerves.musculocutaneous_nerve.push([(b.cx + deep.cx) / 2 - 0.6 * t, y, (b.cz + deep.cz) / 2]);
  // 노신경: 위팔뼈 둘레를 뒤안쪽 → 뒤 → 앞가쪽으로 나선형
  if (h) {
    // 150°(뒤안쪽) → 180°(뒤) → 290°(앞가쪽): 앞이 아니라 뒤로 감아 돈다
    const phi = (lerp(150, 290, Math.min(1, t * 1.1)) * Math.PI) / 180;
    // 아래쪽 위관절융기에서 위팔뼈 폭이 넓어지므로, 몸통 굵기로 상한을 둔다
    const r = Math.min((h.maxX - h.minX) / 2, 1.4) + 0.45;
    nerves.radial_nerve.push([h.cx + r * Math.sin(phi), y, h.cz + r * Math.cos(phi)]);
  }
});
// 신경은 근막 안쪽(깊은 층)에 있어야 한다: 근막 반지름보다 안쪽으로 끌어당긴다
function fasciaAt(phiDeg, y) {
  const a = ((((phiDeg % 360) + 360) % 360) / 360) * ANG;
  const j = Math.min(ROWS - 1, Math.max(0, ((y + HALF) / (2 * HALF)) * (ROWS - 1)));
  const a0 = Math.floor(a) % ANG, a1 = (a0 + 1) % ANG, ta = a - Math.floor(a);
  const j0 = Math.floor(j), j1 = Math.min(ROWS - 1, j0 + 1), tj = j - j0;
  const row = (jj) => fascia[jj][a0] * (1 - ta) + fascia[jj][a1] * ta;
  return row(j0) * (1 - tj) + row(j1) * tj;
}
const NERVE_MARGIN = 0.5; // 신경 굵기(≈0.17) + 곡선 보간 오차 여유
let clamped = 0;
for (const [k, pts] of Object.entries(nerves)) {
  nerves[k] = pts.map(([x, y, z]) => {
    const r = Math.hypot(x, z);
    const limit = fasciaAt(phiOf(x, z), y) - NERVE_MARGIN;
    if (r > limit) {
      clamped++;
      const s = limit / r;
      return [x * s, y, z * s].map(round);
    }
    return [x, y, z].map(round);
  });
  console.log(`${k}: ${pts.length} pts`);
}
console.log(`nerve points pulled inside fascia: ${clamped}`);

// ---------- 5. 땡시 핀 위치: 중간 높이에서 축에서 가장 먼 표면 점 ----------
function surfacePin(id) {
  const p = positionsOf(id);
  let sy = 0;
  for (let i = 1; i < p.length; i += 3) sy += p[i];
  const yMid = sy / (p.length / 3);
  let best = null;
  let bestR = -1;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.abs(p[i + 1] - yMid) > 1) continue;
    const r = Math.hypot(p[i], p[i + 2]);
    if (r > bestR) {
      bestR = r;
      best = [p[i], p[i + 1], p[i + 2]];
    }
  }
  return best.map(round);
}
const pins = {};
for (const id of [...Object.keys(SOURCES), ...Object.keys(GROUPS)]) pins[id] = surfacePin(id);
for (const [k, pts] of Object.entries(nerves)) pins[k] = pts[Math.floor(pts.length * 0.45)];

// ---------- 6. 쓰기 ----------
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('arm');
for (const [id, m] of Object.entries(meshes)) {
  const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.positions)).setBuffer(buffer);
  const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.indices)).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
  const mesh = doc.createMesh(id).addPrimitive(prim);
  const node = doc
    .createNode(id)
    .setMesh(mesh)
    .setExtras({ fma: SOURCES[id].map(([f]) => f), bp3dFiles: SOURCES[id].map(([, f]) => f) });
  scene.addChild(node);
}
mkdirSync('public/models', { recursive: true });
mkdirSync('src/data/generated', { recursive: true });
await new NodeIO().write('public/models/arm.glb', doc);

const meta = {
  source: 'BodyParts3D 4.0 (obj_99), © The Database Center for Life Science',
  note: '오른쪽 위팔, 원본 z 1030–1280mm 구간을 잘라 cm 단위로 변환. 피부·피하조직·근막과 신경 경로는 BodyParts3D에 없어 실제 구조물에 맞춰 생성함.',
  halfLength: HALF,
  meanSkinRadius: round(meanSkinR),
  envelope: { angles: ANG, rows: ROWS, skin, subcut, fascia },
  fma: Object.fromEntries(Object.entries(SOURCES).map(([id, l]) => [id, l.map(([f]) => f)])),
  groups: GROUPS,
  veinLines: { cephalic_vein: centerline('cephalic_vein'), basilic_vein: centerline('basilic_vein') },
  nerves,
  pins,
};
writeFileSync('src/data/generated/arm-meta.json', JSON.stringify(meta));
console.log(`half=${HALF}cm meanSkinR=${meanSkinR.toFixed(2)}cm → public/models/arm.glb, src/data/generated/arm-meta.json`);
