import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** BodyParts3D OBJ(v / f v//vn) 를 위치 배열과 삼각형 인덱스로 읽는다. 법선은 버리고 앱에서 다시 계산한다. */
export function readObj(path) {
  const text = readFileSync(path, 'utf8');
  const positions = [];
  const indices = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      const [, x, y, z] = line.trim().split(/\s+/);
      positions.push(+x, +y, +z);
    } else if (line.startsWith('f ')) {
      const idx = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => parseInt(t.split('/')[0], 10) - 1);
      for (let i = 1; i + 1 < idx.length; i++) indices.push(idx[0], idx[i], idx[i + 1]);
    }
  }
  return { positions, indices };
}

/** IS-A, PART-OF 두 압축 해제 폴더 중 파일이 있는 쪽을 찾는다 */
export function findObj(extractedDir, fileId) {
  for (const sub of ['isa_BP3D_4.0_obj_99', 'partof_BP3D_4.0_obj_99']) {
    const p = join(extractedDir, sub, `${fileId}.obj`);
    if (existsSync(p)) return p;
  }
  throw new Error(`OBJ not found: ${fileId}`);
}
