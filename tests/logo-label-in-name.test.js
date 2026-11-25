/**
 * 로고 접근성 이름 — WCAG 2.5.3 Label in Name (보이는 글자가 접근성 이름에 포함돼야 한다)
 *
 * 규칙
 *  - 로고 링크(.gnb-logo)는 페이지당 1개이고 aria-label 은 정의(NAV.LOGO.ariaLabel)와 같다.
 *  - 보이는 글자 = 로고 <a> 안쪽에서 <svg> 와 aria-hidden="true" 요소를 뺀 텍스트(공백 정규화).
 *  - 보이는 글자가 접근성 이름에 연속 문자열로 들어 있으면 충족.
 *
 * 알려진 미충족(KNOWN_UNMET)
 *  오너가 "(다) 접근성 이름을 'UXW' 로 시작하게 정의를 바꾼다" 를 선택했다.
 *  이 11쪽(principles 10쪽 + prompt-library)은 보이는 글자가 'K UX Writing'
 *  ('K' 마크가 aria-hidden 이 아님)이라 정의 값에 연속 포함되지 않아 여전히 미충족이다.
 *  보이는 글자 변경은 이번 범위가 아니며 후속 결정 사항이다.
 *  목록은 줄어들기만 한다: 목록의 쪽이 충족으로 바뀌면 "목록에서 빼라" 고 실패하고,
 *  목록에 없는 쪽이 미충족이면 실패한다.
 *
 * 파일 목록은 NAV.PAGE_MAP 에서 만든다(쪽이 추가되면 자동으로 검사 대상이 된다).
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const NAV = require('../shared/nav-definition.js');

const ROOT = process.cwd();
const FILES = Object.keys(NAV.PAGE_MAP);

const KNOWN_UNMET = [
  'principles/index.html',
  'principles/components/index.html',
  'principles/core-info/index.html',
  'principles/derivative/index.html',
  'principles/foundation/index.html',
  'principles/governance/index.html',
  'principles/no-translation/index.html',
  'principles/notation/index.html',
  'principles/safety-net/index.html',
  'principles/structure/index.html',
  'prompt-library.html',
];

const classTokens = (tag) => ((tag.match(/\bclass="([^"]*)"/) || [, ''])[1]).split(/\s+/);

/** 로고 <a> 들을 { tag, inner } 로 돌려준다. (로고 안에 <a> 중첩은 없다) */
function logoAnchors(html) {
  const out = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0].slice(0, m[0].indexOf('>') + 1);
    if (classTokens(tag).includes('gnb-logo')) out.push({ tag, inner: m[1] });
  }
  return out;
}

/** 보이는 글자: svg·aria-hidden 요소 제거 → 태그 제거 → 공백 정규화 */
function visibleText(inner) {
  return inner
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, '')
    .replace(/<(\w+)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const info = FILES.map((file) => {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const logos = logoAnchors(html);
  const label = logos.length === 1 ? (logos[0].tag.match(/\baria-label="([^"]*)"/) || [, null])[1] : null;
  const visible = logos.length === 1 ? visibleText(logos[0].inner) : null;
  return { file, logos, label, visible, met: Boolean(visible) && label !== null && label.includes(visible) };
});

describe('로고 접근성 이름: 단일 출처', () => {
  it('PAGE_MAP 이 20쪽이고 모두 실제 파일이다', () => {
    expect(FILES.length).toBe(20);
    FILES.forEach((f) => expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true));
  });

  it.each(info.map((i) => [i.file, i]))('%s: 로고가 1개이고 aria-label 이 정의와 같다', (_f, i) => {
    expect(i.logos.length).toBe(1);
    expect(i.label).toBe(NAV.LOGO.ariaLabel);
  });
});

describe('로고 접근성 이름: WCAG 2.5.3 Label in Name', () => {
  it('홈은 보이는 글자가 정확히 UXW 이고 접근성 이름이 UXW 로 시작한다', () => {
    const home = info.find((i) => i.file === 'index.html');
    expect(home.visible).toBe('UXW');
    expect(home.label.startsWith('UXW')).toBe(true);
  });

  it('알려진 미충족 목록은 PAGE_MAP 의 쪽만 담고 중복이 없다', () => {
    expect(new Set(KNOWN_UNMET).size).toBe(KNOWN_UNMET.length);
    KNOWN_UNMET.forEach((f) => expect(FILES, f).toContain(f));
    expect(KNOWN_UNMET.length).toBe(11);
  });

  const satisfied = info.filter((i) => !KNOWN_UNMET.includes(i.file));
  const unmet = info.filter((i) => KNOWN_UNMET.includes(i.file));

  it('충족 쪽은 9쪽이다 (홈 포함, 20쪽 - 알려진 미충족 11쪽)', () => {
    expect(satisfied.length).toBe(9);
  });

  it.each(satisfied.map((i) => [i.file, i]))('%s: 보이는 글자가 접근성 이름에 포함된다', (_f, i) => {
    expect(i.visible, '보이는 글자가 비어 있다').toBeTruthy();
    expect(i.label, `보이는 글자 "${i.visible}" 가 접근성 이름 "${i.label}" 에 없다(목록에 없는 미충족)`).toContain(i.visible);
  });

  it.each(unmet.map((i) => [i.file, i]))('%s: 알려진 미충족 — 보이는 글자가 K UX Writing 이고 이름에 연속 포함되지 않는다', (_f, i) => {
    expect(i.visible).toBe('K UX Writing');
    // 충족으로 바뀌었다면 KNOWN_UNMET 에서 이 쪽을 빼라(목록은 줄어들기만 한다).
    expect(i.label.includes(i.visible), `${i.file} 이(가) 충족으로 바뀌었다 — KNOWN_UNMET 에서 빼라`).toBe(false);
  });
});

describe('보이는 글자 계산 도우미', () => {
  it('svg 와 aria-hidden 요소를 제거하고 공백을 정규화한다', () => {
    const inner = '\n <svg class="m" aria-hidden="true"><g></g></svg>\n <span aria-hidden="true">K</span>\n <span>UX   Writing</span>\n';
    expect(visibleText(inner)).toBe('UX Writing');
  });

  it('aria-hidden 이 아닌 K 마크는 보이는 글자에 남는다', () => {
    expect(visibleText('<span class="gnb-logo-mark">K</span>\n<span>UX Writing</span>')).toBe('K UX Writing');
  });
});
