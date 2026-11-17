// BodyParts3D 메시를 부위별로 잘라 앱용 glb + 메타데이터로 변환하고, 상체 전체 보기도 만든다.
// 사용법: node scripts/bp3d/build-region.mjs <extracted 폴더> [부위 id ...]   (부위를 안 주면 전부 + 상체 전체)
//   출력: public/models/<부위>.glb, src/data/generated/<부위>-meta.json, src/data/generated/catalog.json
//
// 원본 좌표계(mm): x = 오른쪽(-)→왼쪽(+), y = 앞(-)→뒤(+), z = 위(+)
// 앱 좌표계(cm):   x = 안쪽(+, 오른팔 기준), y = 위(+), z = 앞(+)
//   부위 보기: 부위 축을 원점에 두고 기울어진 팔다리 축을 전단 변환으로 세운다.
//   상체 전체: 몸 정중선을 x=0에 두고 원래 자세 그대로 둔다 (오른쪽 = -x).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readObj, findObj } from './obj.mjs';
import { REGIONS, COMBINED } from './regions.mjs';
import { CATALOG } from './catalog.mjs';

const [extracted, ...only] = process.argv.slice(2);
if (!extracted) throw new Error('extracted 폴더 경로를 넘겨 주세요');
const bp3dDir = dirname(extracted.replace(/[\\/]+$/, ''));
const targets = only.length ? only : [...Object.keys(REGIONS), COMBINED.id];

const round = (v) => Math.round(v * 1000) / 1000;
const lerp = (a, b, t) => a + (b - a) * t;
const phiOf = (x, z) => (Math.atan2(x, z) * 180) / Math.PI; // 0 = 앞, + = 안쪽

const ANG = 48;
const ROWS = 41;
const NERVE_MARGIN = 0.5; // 신경 굵기(≈0.17) + 곡선 보간 오차 여유
/** 메시 하나의 삼각형 상한. 넘으면 모양을 지키며 줄인다 (부위 보기 / 상체 전체) */
const MAX_TRIS = 12000;
const MAX_TRIS_COMBINED = 1600;

await MeshoptSimplifier.ready;

// ---------- 이름 → FMA → OBJ 파일 ----------
const readTable = (f) =>
  readFileSync(join(bp3dDir, f), 'utf8')
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split('\t'))
    .filter((c) => c.length >= 3);
const nameToFma = new Map();
for (const f of ['isa_parts_list_e.txt', 'partof_parts_list_e.txt'])
  for (const [fma, , en] of readTable(f)) if (!nameToFma.has(en.toLowerCase())) nameToFma.set(en.toLowerCase(), fma);
const fmaFiles = new Map();
for (const f of ['isa_element_parts.txt', 'partof_element_parts.txt'])
  for (const [fma, , file] of readTable(f)) {
    if (!fmaFiles.has(fma)) fmaFiles.set(fma, new Set());
    fmaFiles.get(fma).add(file);
  }
/** source 항목: [FMA, OBJ 파일] 또는 { name: 'right first rib' } */
function resolve(list) {
  const out = [];
  for (const s of list) {
    if (Array.isArray(s)) out.push(s);
    else {
      const fma = nameToFma.get(s.name.toLowerCase());
      if (!fma) throw new Error(`BodyParts3D에 없는 이름: ${s.name}`);
      for (const file of fmaFiles.get(fma) ?? []) out.push([fma, file]);
    }
  }
  return out;
}

// ---------- 메시 읽기·자르기·줄이기 ----------
function loadMerged(sourceList, zLo, zHi) {
  const merged = { positions: [], indices: [] };
  for (const [, fileId] of sourceList) {
    let obj;
    try {
      obj = readObj(findObj(extracted, fileId));
    } catch {
      continue; // 압축 해제본에 없는 파일 (드묾)
    }
    const { positions, indices } = obj;
    const keep = new Map();
    const base = merged.positions.length / 3;
    const inside = (i) => positions[i * 3 + 2] >= zLo && positions[i * 3 + 2] <= zHi;
    for (let t = 0; t < indices.length; t += 3) {
      const tri = [indices[t], indices[t + 1], indices[t + 2]];
      if (!tri.every(inside)) continue;
      for (const i of tri) {
        if (!keep.has(i)) {
          keep.set(i, base + keep.size);
          merged.positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        }
        merged.indices.push(keep.get(i));
      }
    }
  }
  return merged;
}

/** 삼각형이 maxTris를 넘으면 meshoptimizer로 줄인다 (가까운 꼭짓점을 합친 뒤 단순화) */
function simplify(mesh, maxTris) {
  const tris = mesh.indices.length / 3;
  if (tris <= maxTris) return mesh;
  // 파일 경계에서 떨어진 꼭짓점을 0.01mm 격자로 합쳐야 단순화가 이음매를 찢지 않는다
  const key = new Map();
  const pos = [];
  const remap = [];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const k = `${Math.round(mesh.positions[i] * 100)},${Math.round(mesh.positions[i + 1] * 100)},${Math.round(mesh.positions[i + 2] * 100)}`;
    if (!key.has(k)) {
      key.set(k, pos.length / 3);
      pos.push(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
    }
    remap.push(key.get(k));
  }
  const idx = new Uint32Array(mesh.indices.map((i) => remap[i]));
  const target = Math.floor(maxTris) * 3;
  let [out] = MeshoptSimplifier.simplify(idx, new Float32Array(pos), 3, target, 0.02);
  if (out.length > target * 1.5) [out] = MeshoptSimplifier.simplifySloppy(idx, new Float32Array(pos), 3, target, 0.05);
  // 쓰인 꼭짓점만 남긴다
  const used = new Map();
  const positions = [];
  const indices = [];
  for (const i of out) {
    if (!used.has(i)) {
      used.set(i, positions.length / 3);
      positions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
    indices.push(used.get(i));
  }
  return { positions, indices };
}

// ---------- 공통: 단면 통계, 핀, 쓰기 ----------
function helpers(meshes, groups) {
  const positionsOf = (id) => (groups?.[id] ? groups[id].flatMap((h) => meshes[h]?.positions ?? []) : meshes[id]?.positions ?? []);
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
  /** 중간 높이에서 (cx, cz) 축으로부터 가장 먼 표면 점 */
  const surfacePin = (id, cx = 0, cz = 0) => {
    const p = positionsOf(id);
    if (!p.length) return null;
    let sy = 0;
    for (let i = 1; i < p.length; i += 3) sy += p[i];
    const yMid = sy / (p.length / 3);
    let best = null;
    let bestR = -1;
    for (const band of [1, 3, Infinity]) {
      for (let i = 0; i < p.length; i += 3) {
        if (Math.abs(p[i + 1] - yMid) > band) continue;
        const r = Math.hypot(p[i] - cx, p[i + 2] - cz);
        if (r > bestR) {
          bestR = r;
          best = [p[i], p[i + 1], p[i + 2]];
        }
      }
      if (best) break;
    }
    return best.map(round);
  };
  return { positionsOf, slice, frontmost, surfacePin };
}

/** 카메라가 부위 전체를 담는 거리 (세로 시야각 40°, 가로가 더 넓어도 들어오게) */
function viewDistanceOf(meshes) {
  let halfH = 0;
  let halfW = 0;
  for (const m of Object.values(meshes))
    for (let i = 0; i < m.positions.length; i += 3) {
      halfH = Math.max(halfH, Math.abs(m.positions[i + 1]));
      halfW = Math.max(halfW, Math.abs(m.positions[i]), Math.abs(m.positions[i + 2]));
    }
  return round(Math.max(halfH * 3.1, halfW * 2.6) + 4);
}

async function writeGlb(name, meshes, sources) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  for (const [id, m] of Object.entries(meshes)) {
    const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array(m.positions)).setBuffer(buffer);
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(m.indices)).setBuffer(buffer);
    const prim = doc.createPrimitive().setAttribute('POSITION', pos).setIndices(idx);
    const mesh = doc.createMesh(id).addPrimitive(prim);
    const node = doc
      .createNode(id)
      .setMesh(mesh)
      .setExtras({ fma: [...new Set(sources[id].map(([f]) => f))], bp3dFiles: sources[id].map(([, f]) => f) });
    scene.addChild(node);
  }
  mkdirSync('public/models', { recursive: true });
  await new NodeIO().write(`public/models/${name}.glb`, doc);
}

const tris = (meshes) => Object.values(meshes).reduce((a, m) => a + m.indices.length / 3, 0);

// ---------- 부위 하나 ----------
async function buildRegion(regionId, R) {
  const Z_MID = (R.zLo + R.zHi) / 2;
  const HALF = (R.zHi - R.zLo) / 20; // cm
  const sources = Object.fromEntries(Object.entries(R.sources).map(([id, list]) => [id, resolve(list)]));
  const deepIds = R.deep ?? Object.keys(sources).filter((id) => !(R.veins ?? []).includes(id));

  // 1. 읽기와 자르기
  const raw = {};
  const skipped = [];
  for (const [id, list] of Object.entries(sources)) {
    const m = loadMerged(list, R.zLo, R.zHi);
    if (m.positions.length) raw[id] = m;
    else skipped.push(id);
  }
  if (skipped.length) console.log(`  범위 밖이라 뺀 구조물: ${skipped.join(', ')}`);

  // 2. 축: 팔다리는 기준 뼈의 중심선을 직선 회귀해 전단 변환으로 세우고, 몸통은 깊은 구조물의 평균 중심을 쓴다
  let fit = { x: { at0: 0, slope: 0 }, y: { at0: 0, slope: 0 } };
  if (R.straighten !== false) {
    const pts = [];
    for (let z = R.axisZ[0]; z <= R.axisZ[1]; z += 10) {
      let sx = 0, sy = 0, n = 0;
      for (const id of R.axisFrom) {
        const p = raw[id]?.positions ?? [];
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
      const slope = pts.reduce((a, q) => a + (q[0] - mz) * (q[k] - mv), 0) / pts.reduce((a, q) => a + (q[0] - mz) ** 2, 0);
      return { at0: mv - slope * mz, slope };
    };
    fit = { x: line(1), y: line(2) };
  }
  let offX = 0, offY = 0, offN = 0;
  for (const id of deepIds) {
    const p = raw[id]?.positions ?? [];
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
  console.log(`  axis tilt ${tilt.toFixed(1)}°, center ${offX.toFixed(1)},${offY.toFixed(1)} mm`);

  const toApp = (x, y, z) => {
    const [ax, ay] = axisAt(z);
    return [(x - ax) / 10, (z - Z_MID) / 10, -(y - ay) / 10];
  };
  /** 앱 좌표(cm) → 원본(mm). 상체 전체 보기에서 신경 경로를 제자리에 놓을 때 쓴다. */
  const toOriginal = ([x, y, z]) => {
    const oz = y * 10 + Z_MID;
    const [ax, ay] = axisAt(oz);
    return [x * 10 + ax, -z * 10 + ay, oz];
  };

  const meshes = {};
  for (const [id, m] of Object.entries(raw)) {
    const s = simplify(m, R.maxTris ?? MAX_TRIS);
    const p = [];
    for (let i = 0; i < s.positions.length; i += 3) p.push(...toApp(s.positions[i], s.positions[i + 1], s.positions[i + 2]));
    meshes[id] = { positions: p, indices: s.indices };
  }
  console.log(`  ${Object.keys(meshes).length} meshes, ${tris(meshes)} tris`);

  const H = helpers(meshes, R.groups);
  const meta = {
    region: regionId,
    source: 'BodyParts3D 4.0 (obj_99), © The Database Center for Life Science',
    note: `${R.title}, 원본 z ${R.zLo}–${R.zHi}mm 구간을 잘라 cm 단위로 변환.`,
    halfLength: HALF,
    tiltDeg: round(tilt),
    viewDistance: viewDistanceOf(meshes),
    envelope: null,
    meanSkinRadius: null,
    fma: Object.fromEntries(Object.entries(sources).filter(([id]) => meshes[id]).map(([id, l]) => [id, [...new Set(l.map(([f]) => f))]])),
    groups: R.groups ?? {},
    veinLines: {},
    nerves: {},
    pins: {},
  };

  // 3. 피부·근막 외피 (팔다리만): 깊은 구조물 + 표재정맥을 감싸는 별 모양 껍질
  let fascia = null;
  if (R.envelope !== false) {
    const radialMax = (ids) => {
      const grid = Array.from({ length: ROWS }, () => new Array(ANG).fill(0));
      for (const id of ids) {
        const p = meshes[id]?.positions ?? [];
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
    const deepR = fillAndSmooth(radialMax(deepIds), 2.2, 4);
    const veinR = radialMax(R.veins ?? []);
    // 표재정맥은 근막 바깥(피하조직)에 있어야 하므로, 정맥이 지나는 칸에서는 근막을 정맥 아래로 내린다
    const veinNear = veinR.map((row) => row.map((r) => (r ? r : 99)));
    fascia = deepR.map((row, j) => row.map((r, a) => round(Math.max(r - 0.8, Math.min(r + 0.15, veinNear[j][a] - 0.35)))));
    const skinRaw = fascia.map((row, j) => row.map((r, a) => Math.max(r + 0.75, veinR[j][a] ? veinR[j][a] + 0.35 : 0)));
    const skin = fillAndSmooth(skinRaw, 3, 3).map((row) => row.map(round));
    const subcut = skin.map((row) => row.map((r) => round(r - 0.3)));
    meta.envelope = { angles: ANG, rows: ROWS, skin, subcut, fascia };
    meta.meanSkinRadius = round(skin.flat().reduce((a, b) => a + b, 0) / (ROWS * ANG));
  }

  // 4. 신경 경로 (팔다리만): 실제 구조물 위치로 만들고, 근막 안쪽에 머물게 당긴 뒤 매끄럽게 편다
  const nervesOrig = {};
  if (R.nerves) {
    const ys = Array.from({ length: 25 }, (_, i) => lerp(HALF - 0.3, -HALF + 0.3, i / 24));
    const mix = (a, b, t, y) => [lerp(a.cx, b.cx, t), y, lerp(a.cz, b.cz, t)];
    const rawNerves = R.nerves({ ys, slice: H.slice, frontmost: H.frontmost, mix, HALF });
    const fasciaAt = (phiDeg, y) => {
      const a = ((((phiDeg % 360) + 360) % 360) / 360) * ANG;
      const j = Math.min(ROWS - 1, Math.max(0, ((y + HALF) / (2 * HALF)) * (ROWS - 1)));
      const a0 = Math.floor(a) % ANG, a1 = (a0 + 1) % ANG, ta = a - Math.floor(a);
      const j0 = Math.floor(j), j1 = Math.min(ROWS - 1, j0 + 1), tj = j - j0;
      const row = (jj) => fascia[jj][a0] * (1 - ta) + fascia[jj][a1] * ta;
      return row(j0) * (1 - tj) + row(j1) * tj;
    };
    let clamped = 0;
    const clampInside = ([x, y, z], count) => {
      if (!fascia) return [x, y, z];
      const r = Math.hypot(x, z);
      const limit = fasciaAt(phiOf(x, z), y) - NERVE_MARGIN;
      if (r <= limit) return [x, y, z];
      if (count) clamped++;
      return [(x * limit) / r, y, (z * limit) / r];
    };
    const smooth = (pts) =>
      pts.map((p, i) =>
        i === 0 || i === pts.length - 1 ? p : [0, 1, 2].map((k) => (k === 1 ? p[1] : (pts[i - 1][k] + 2 * p[k] + pts[i + 1][k]) / 4)),
      );
    for (const [k, pts] of Object.entries(rawNerves)) {
      if (pts.length < 4) throw new Error(`${k}: 신경 경로 점이 ${pts.length}개뿐입니다 — 기준 구조물을 확인하세요`);
      let path = pts.map((p) => clampInside(p, true));
      for (let pass = 0; pass < 3; pass++) path = smooth(path).map((p) => clampInside(p, false));
      meta.nerves[k] = path.map((p) => p.map(round));
      nervesOrig[k] = meta.nerves[k].map(toOriginal);
    }
    console.log(`  nerves: ${Object.keys(meta.nerves).join(', ')} (근막 안으로 당긴 점 ${clamped}개)`);
  }

  // 5. 중심선과 핀
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
    return [...bins.entries()].sort((a, b) => b[0] - a[0]).map(([, b]) => [round(b[0] / b[3]), round(b[1] / b[3]), round(b[2] / b[3])]);
  };
  for (const v of R.veins ?? []) if (meshes[v]) meta.veinLines[v] = centerline(v);
  for (const id of [...Object.keys(meshes), ...Object.keys(R.groups ?? {})]) {
    const pin = H.surfacePin(id);
    if (pin) meta.pins[id] = pin;
  }
  for (const [k, pts] of Object.entries(meta.nerves)) meta.pins[k] = pts[Math.floor(pts.length * 0.45)];

  await writeGlb(regionId, meshes, sources);
  mkdirSync('src/data/generated', { recursive: true });
  writeFileSync(`src/data/generated/${regionId}-meta.json`, JSON.stringify(meta));
  console.log(`  → public/models/${regionId}.glb (view ${meta.viewDistance}cm)`);
  return { sources, nervesOrig };
}

// ---------- 상체 전체 ----------
async function buildCombined(built) {
  const sources = {};
  const owner = {};
  for (const part of COMBINED.parts) {
    const R = REGIONS[part];
    for (const [id, list] of Object.entries(R.sources)) {
      if (sources[id]) continue; // 여러 부위에 나오는 구조물은 한 번만 (자르지 않은 원래 메시)
      sources[id] = resolve(list);
      owner[id] = part;
    }
  }
  const mirror = Object.keys(sources).filter((id) => COMBINED.mirrorParts.includes(owner[id]));

  // 원래 자세 그대로, 몸 정중선 x=0. 앞뒤 중심과 높이 중심만 맞춘다.
  const raw = {};
  for (const [id, list] of Object.entries(sources)) {
    const m = loadMerged(list, COMBINED.zLo, COMBINED.zHi);
    if (m.positions.length) raw[id] = simplify(m, MAX_TRIS_COMBINED);
  }
  let sy = 0, n = 0;
  for (const part of ['thorax', 'abdomen']) for (const id of Object.keys(REGIONS[part].sources)) {
    const p = raw[id]?.positions ?? [];
    for (let i = 1; i < p.length; i += 3) {
      sy += p[i];
      n++;
    }
  }
  const Y_MID = sy / n;
  const Z_MID = (COMBINED.zLo + COMBINED.zHi) / 2;
  const toApp = (x, y, z) => [x / 10, (z - Z_MID) / 10, -(y - Y_MID) / 10];
  const meshes = {};
  for (const [id, m] of Object.entries(raw)) {
    const p = [];
    for (let i = 0; i < m.positions.length; i += 3) p.push(...toApp(m.positions[i], m.positions[i + 1], m.positions[i + 2]));
    meshes[id] = { positions: p, indices: m.indices };
  }
  console.log(`  ${Object.keys(meshes).length} meshes (+ 왼쪽 대칭 ${mirror.length}), ${tris(meshes)} tris`);

  const nerves = {};
  for (const part of COMBINED.nerveParts)
    for (const [k, pts] of Object.entries(built[part]?.nervesOrig ?? {})) nerves[k] = pts.map(([x, y, z]) => toApp(x, y, z).map(round));

  const H = helpers(meshes, {});
  const pins = {};
  for (const id of Object.keys(meshes)) {
    // 몸통 기준 핀은 몸 중심축에서, 오른팔 구조물은 팔 쪽에서 가장 바깥 점
    const pin = H.surfacePin(id);
    if (pin) pins[id] = pin;
  }
  for (const [k, pts] of Object.entries(nerves)) pins[k] = pts[Math.floor(pts.length * 0.45)];

  const meta = {
    region: COMBINED.id,
    source: 'BodyParts3D 4.0 (obj_99), © The Database Center for Life Science',
    note: `상체 전체, 원본 z ${COMBINED.zLo}–${COMBINED.zHi}mm, 원래 자세. 왼팔은 오른팔 구조물을 정중선 기준으로 대칭 복사해 표시.`,
    halfLength: (COMBINED.zHi - COMBINED.zLo) / 20,
    tiltDeg: 0,
    viewDistance: viewDistanceOf(meshes),
    envelope: null,
    meanSkinRadius: null,
    fma: Object.fromEntries(Object.entries(sources).filter(([id]) => meshes[id]).map(([id, l]) => [id, [...new Set(l.map(([f]) => f))]])),
    groups: Object.assign({}, ...COMBINED.parts.map((p) => REGIONS[p].groups ?? {})),
    owner,
    mirror: mirror.filter((id) => meshes[id] || nerves[id]).concat(Object.keys(nerves)),
    veinLines: {},
    nerves,
    pins,
  };
  await writeGlb(COMBINED.id, meshes, sources);
  writeFileSync(`src/data/generated/${COMBINED.id}-meta.json`, JSON.stringify(meta));
  console.log(`  → public/models/${COMBINED.id}.glb (view ${meta.viewDistance}cm)`);
}

// ---------- 실행 ----------
const built = {};
for (const id of targets) {
  if (id === COMBINED.id) continue;
  const R = REGIONS[id];
  if (!R) throw new Error(`알 수 없는 부위: ${id}`);
  console.log(`\n=== ${id} (${R.title}) ===`);
  built[id] = await buildRegion(id, R);
}
if (targets.includes(COMBINED.id)) {
  // 상체 전체의 신경은 팔·아래팔 빌드 결과에서 가져온다
  for (const p of COMBINED.nerveParts) if (!built[p]) {
    console.log(`\n=== ${p} (신경 경로용) ===`);
    built[p] = await buildRegion(p, REGIONS[p]);
  }
  console.log(`\n=== ${COMBINED.id} (${COMBINED.title}) ===`);
  await buildCombined(built);
}

// 앱이 읽을 구조물 목록 (몸통·어깨·손)
writeFileSync(
  'src/data/generated/catalog.json',
  JSON.stringify(CATALOG.map(({ bp3d, ...e }) => ({ ...e, fmaId: null }))),
);
