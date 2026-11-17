// BodyParts3D에서 이름으로 구조물을 찾아 FMA ID, OBJ 파일, 높이 범위를 보여 준다.
// 사용법: node scripts/bp3d/find.mjs <bodyparts3d 폴더> <정규식> [정규식 ...]
//   예: node scripts/bp3d/find.mjs .data/bodyparts3d "^right pectoralis" "^heart$"
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readObj, findObj } from './obj.mjs';

const [dir, ...patterns] = process.argv.slice(2);
const parse = (f) =>
  readFileSync(join(dir, f), 'utf8')
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split('\t'))
    .filter((c) => c.length >= 3);
const names = new Map();
for (const f of ['isa_parts_list_e.txt', 'partof_parts_list_e.txt']) for (const [fma, , en] of parse(f)) names.set(fma, en);
const files = new Map();
for (const f of ['isa_element_parts.txt', 'partof_element_parts.txt'])
  for (const [fma, , file] of parse(f)) {
    if (!files.has(fma)) files.set(fma, new Set());
    files.get(fma).add(file);
  }

for (const p of patterns) {
  const re = new RegExp(p, 'i');
  for (const [fma, en] of names) {
    if (!re.test(en)) continue;
    const fs = [...(files.get(fma) ?? [])];
    let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity, tris = 0;
    for (const id of fs.slice(0, 60)) {
      try {
        const { positions, indices } = readObj(findObj(join(dir, 'extracted'), id));
        tris += indices.length / 3;
        for (let i = 0; i < positions.length; i += 3) {
          xmin = Math.min(xmin, positions[i]);
          xmax = Math.max(xmax, positions[i]);
          zmin = Math.min(zmin, positions[i + 2]);
          zmax = Math.max(zmax, positions[i + 2]);
        }
      } catch {
        /* 압축 해제본에 없는 파일 */
      }
    }
    const range = Number.isFinite(zmin) ? `z ${zmin.toFixed(0)}–${zmax.toFixed(0)} x ${xmin.toFixed(0)}–${xmax.toFixed(0)} tris ${tris}` : 'no mesh';
    console.log(`${fma}\t${en}\t${fs.length} files\t${range}`);
  }
}
