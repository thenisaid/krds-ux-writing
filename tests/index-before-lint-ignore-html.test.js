import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const HTML = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

// <div class="ba-col ba-col--KIND"> 안의 <p class="ba-text">...</p> 여는 태그를 모은다.
// 줄 번호가 아니라 클래스 구조로 판별한다. 컬럼은 라벨 <div> 와 <p> 하나로 이뤄지므로
// 컬럼 끝(</p> 바로 뒤 </div>)까지를 한 컬럼으로 본다.
function collectBaTextOpenTags(kind) {
  const colRe = new RegExp('<div class="ba-col ba-col--' + kind + '">([\\s\\S]*?</p>)\\s*</div>', 'g');
  const tags = [];
  let col;
  while ((col = colRe.exec(HTML)) !== null) {
    const pRe = /<p\b[^>]*\bclass="ba-text"[^>]*>/g;
    let p;
    while ((p = pRe.exec(col[1])) !== null) tags.push(p[0]);
  }
  return tags;
}

describe('index Before/After 예시의 린트 제외 마크업', () => {
  const before = collectBaTextOpenTags('before');
  const after = collectBaTextOpenTags('after');

  it('Before(ba-col--before)와 After(ba-col--after)의 p.ba-text 는 각각 12개다', () => {
    expect(before).toHaveLength(12);
    expect(after).toHaveLength(12);
  });

  it('ba-col--before 의 모든 p.ba-text 는 data-lint-ignore="의도된 Before 예시" 를 가진다', () => {
    before.forEach((tag) => {
      expect(tag).toContain('data-lint-ignore="의도된 Before 예시"');
    });
  });

  it('ba-col--after 의 p.ba-text 는 data-lint-ignore 를 가지지 않는다', () => {
    after.forEach((tag) => {
      expect(tag).not.toContain('data-lint-ignore');
    });
  });

  it('index.html 의 data-lint-ignore 는 Before 의 p.ba-text 12곳에만 존재한다', () => {
    expect((HTML.match(/data-lint-ignore/g) || []).length).toBe(12);
  });
});
