// BodyParts3D 메시를 부위별로 잘라 앱용 glb + 메타데이터로 변환한다.
// 사용법: node scripts/bp3d/build-region.mjs <extracted 폴더> [부위 id ...]   (부위를 안 주면 전부)
//   출력: public/models/<부위>.glb, src/data/generated/<부위>-meta.json
//
// 원본 좌표계(mm): x = 오른쪽(-)→왼쪽(+), y = 앞(-)→뒤(+), z = 위(+)
// 앱 좌표계(cm):   x = 안쪽(+), y = 위(+), z = 앞(+)  (오른팔이므로 원본 +x가 안쪽)

import { mkdirSync, writeFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { readObj, findObj } from './obj.mjs';
import { REGIONS } from './regions.mjs';

const [extracted, ...only] = process.argv.slice(2);
if (!extracted) throw new Error('extracted 폴더 경로를 넘겨 주세요');
const targets = only.length ? only : Object.keys(REGIONS);

const round = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, t) => a + (b - a) * t;
const phiOf = (x, z) => (Math.atan2(x, z) * 180) / Math.PI; // 0 = 앞, + = 안쪽

const ANG = 48;
const ROWS = 41;
const NERVE_MARGIN = 0.5; // 신경 굵기(≈0.17) + 곡선 보간 오차 여유

for (const regionId of targets) {
  const R = REGIONS[regionId];
  if (!R) throw new Error(`알 수 없는 부위: ${regionId}`);
  console.log(`\n=== ${regionId} (${R.title}) ===`);
  await buildRegion(regionId, R);
}

async function buildRegion(regionId, R) {
  const Z_MID = (R.zLo + R.zHi) / 2;
  const HALF = (R.zHi - R.zLo) / 20; // cm

  // ---------- 1. 읽기와 자르기 ----------
  const loadCropped = (fileId) => {
    const { positions, indices } = readObj(findObj(extracted, fileId));
    const keep = new Map();
    const out = { positions: [], indices: [] };
    const inside = (i) => positions[i * 3 + 2] >= R.zLo && positions[i * 3 + 2] <= R.zHi;
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
  };
  const raw = {};
  for (const [id, list] of Object.entries(R.sources)) {
    const merged = { positions: [], indices: [] };
    for (const [, fileId] of list) {
      const part = loadCropped(fileId);
      const base = merged.positions.length / 3;
      merged.positions.push(...part.positions);
      merged.indices.push(...part.indices.map((i) => i + base));
    }
    if (!merged.positions.length) throw new Error(`${id}: 잘라낸 범위 안에 메시가 없습니다`);
    raw[id] = merged;
  }

  // ---------- 2. 축: 기준 뼈의 높이별 중심을 직선 회귀해 전단 변환으로 세운다 ----------
  const fit = (() => {
    const pts = [];
    for (let z = R.axisZ[0]; z <= R.axisZ[1]; z += 10) {
      let sx = 0, sy = 0, n = 0;
      for (const id of R.axisFrom) {
        const p = raw[id].positions;
        for (let i = 0; i < p.length; i += 3) {
          if (Math.abs(p[i + 2] - z) < 5) {
            sx += p[i];
            sy += p[i + 1];
            n++;
          }
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
  // 기준 뼈는 단면의 중심에서 비켜 있으므로, 깊은 구조물의 평균 오프셋을 더해 단면 중심을 축으로 삼는다
  let offX = 0, offY = 0, offN = 0;
  for (const id of R.deep) {
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
  const tilt = (Math.atan(Math.hypot(fit.x.slope, fit.y.slope)) * 180) / Math.PI;
  console.log(`axis tilt ${tilt.toFixed(1)}°, offset ${offX.toFixed(1)},${offY.toFixed(1)} mm`);

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
  }
  console.log(`${Object.keys(meshes).length} meshes, ${Object.values(meshes).reduce((a, m) => a + m.indices.length / 3, 0)} tris`);

  // ---------- 3. 피부·근막 외피 (깊은 구조물 + 표재정맥을 감싸는 별 모양 껍질) ----------
  const radialMax = (ids) => {
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
  };
  const fillAndSmooth = (grid, minR, passes) => {
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
  };
  const deepR = fillAndSmooth(radialMax(R.deep), 2.2, 4);
  const veinR = radialMax(R.veins);
  // 표재정맥은 근막 바깥(피하조직)에 있어야 하므로, 정맥이 지나는 칸에서는 근막을 정맥 아래로 내린다
  const veinNear = veinR.map((row) => row.map((r) => (r ? r : 99)));
  const fascia = deepR.map((row, j) =>
    row.map((r, a) => round(Math.max(r - 0.8, Math.min(r + 0.15, veinNear[j][a] - 0.35)))),
  );
  const skinRaw = fascia.map((row, j) => row.map((r, a) => Math.max(r + 0.75, veinR[j][a] ? veinR[j][a] + 0.35 : 0)));
  const skin = fillAndSmooth(skinRaw, 3, 3).map((row) => row.map(round));
  const subcut = skin.map((row) => row.map((r) => round(r - 0.3)));
  const meanSkinR = skin.flat().reduce((a, b) => a + b, 0) / (ROWS * ANG);

  // ---------- 4. 단면 통계와 신경 경로 ----------
  const positionsOf = (id) =>
    R.groups[id] ? R.groups[id].flatMap((h) => meshes[h].positions) : meshes[id]?.positions ?? [];
  const slice = (id, y, band = 0.6) => {
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
  };
  /** 같은 높이에서 가장 앞쪽(+z) 덩어리의 중심 (갈라지는 혈관에서 본줄기를 고를 때) */
  const frontmost = (id, y) => {
    const p = positionsOf(id);
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
  };
  const mix = (a, b, t, y) => [lerp(a.cx, b.cx, t), y, lerp(a.cz, b.cz, t)];
  const ys = Array.from({ length: 25 }, (_, i) => lerp(HALF - 0.3, -HALF + 0.3, i / 24));
  const rawNerves = R.nerves({ ys, slice, frontmost, mix, HALF });

  const fasciaAt = (phiDeg, y) => {
    const a = ((((phiDeg % 360) + 360) % 360) / 360) * ANG;
    const j = Math.min(ROWS - 1, Math.max(0, ((y + HALF) / (2 * HALF)) * (ROWS - 1)));
    const a0 = Math.floor(a) % ANG, a1 = (a0 + 1) % ANG, ta = a - Math.floor(a);
    const j0 = Math.floor(j), j1 = Math.min(ROWS - 1, j0 + 1), tj = j - j0;
    const row = (jj) => fascia[jj][a0] * (1 - ta) + fascia[jj][a1] * ta;
    return row(j0) * (1 - tj) + row(j1) * tj;
  };
  let clamped = 0;
  // 신경은 근막 안쪽(깊은 층)에 있어야 한다
  const clampInside = ([x, y, z], count) => {
    const r = Math.hypot(x, z);
    const limit = fasciaAt(phiOf(x, z), y) - NERVE_MARGIN;
    if (r <= limit) return [x, y, z];
    if (count) clamped++;
    return [(x * limit) / r, y, (z * limit) / r];
  };
  /** 이웃 점과 평균 내어 지그재그를 편다 (양 끝점은 고정) */
  const smooth = (pts) =>
    pts.map((p, i) =>
      i === 0 || i === pts.length - 1
        ? p
        : [0, 1, 2].map((k) => (k === 1 ? p[1] : (pts[i - 1][k] + 2 * p[k] + pts[i + 1][k]) / 4)),
    );
  const nerves = {};
  for (const [k, pts] of Object.entries(rawNerves)) {
    if (pts.length < 4) throw new Error(`${k}: 신경 경로 점이 ${pts.length}개뿐입니다 — 기준 구조물을 확인하세요`);
    let path = pts.map((p) => clampInside(p, true));
    for (let pass = 0; pass < 3; pass++) path = smooth(path).map((p) => clampInside(p, false));
    nerves[k] = path.map((p) => p.map(round));
    console.log(`${k}: ${pts.length} pts`);
  }
  console.log(`nerve points pulled inside fascia: ${clamped}`);

  // ---------- 5. 중심선과 땡시 핀 ----------
  const centerline = (id, step = 0.5) => {
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
  };
  /** 중간 높이에서 축에서 가장 먼 표면 점 */
  const surfacePin = (id) => {
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
  };
  const pins = {};
  for (const id of [...Object.keys(R.sources), ...Object.keys(R.groups)]) pins[id] = surfacePin(id);
  for (const [k, pts] of Object.entries(nerves)) pins[k] = pts[Math.floor(pts.length * 0.45)];

  // ---------- 6. 쓰기 ----------
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(regionId);
  for (const [id, m] of Object.entries(meshes)) {
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.positions)).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.indices)).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
    const mesh = doc.createMesh(id).addPrimitive(prim);
    const node = doc
      .createNode(id)
      .setMesh(mesh)
      .setExtras({ fma: R.sources[id].map(([f]) => f), bp3dFiles: R.sources[id].map(([, f]) => f) });
    scene.addChild(node);
  }
  mkdirSync('public/models', { recursive: true });
  mkdirSync('src/data/generated', { recursive: true });
  await new NodeIO().write(`public/models/${regionId}.glb`, doc);

  const meta = {
    region: regionId,
    source: 'BodyParts3D 4.0 (obj_99), © The Database Center for Life Science',
    note: `${R.title}, 원본 z ${R.zLo}–${R.zHi}mm 구간을 잘라 cm 단위로 변환. 피부·피하조직·근막과 신경 경로는 BodyParts3D에 없어 실제 구조물에 맞춰 생성함.`,
    halfLength: HALF,
    tiltDeg: round(tilt),
    meanSkinRadius: round(meanSkinR),
    envelope: { angles: ANG, rows: ROWS, skin, subcut, fascia },
    fma: Object.fromEntries(Object.entries(R.sources).map(([id, l]) => [id, [...new Set(l.map(([f]) => f))]])),
    groups: R.groups,
    veinLines: Object.fromEntries(R.veins.map((v) => [v, centerline(v)])),
    nerves,
    pins,
  };
  writeFileSync(`src/data/generated/${regionId}-meta.json`, JSON.stringify(meta));
  console.log(`half=${HALF}cm meanSkinR=${meanSkinR.toFixed(2)}cm → public/models/${regionId}.glb`);
}
