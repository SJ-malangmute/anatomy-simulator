// 사용법: node scripts/bp3d/inspect.mjs <extracted 폴더> FJxxxx [FJyyyy ...]
import { readObj, findObj } from './obj.mjs';

const [dir, ...ids] = process.argv.slice(2);
for (const id of ids) {
  const { positions, indices } = readObj(findObj(dir, id));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const sum = [0, 0, 0];
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i * 3 + k];
      min[k] = Math.min(min[k], v);
      max[k] = Math.max(max[k], v);
      sum[k] += v;
    }
  }
  const f = (a) => a.map((v) => v.toFixed(0)).join(',');
  console.log(`${id} verts=${n} tris=${indices.length / 3} min=(${f(min)}) max=(${f(max)}) mean=(${f(sum.map((s) => s / n))})`);
}
