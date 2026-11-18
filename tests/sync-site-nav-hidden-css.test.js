import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const SYNC = require('../scripts/sync-site-nav.js');

const ROOT = process.cwd();

const MOBILE = (rules) => '@media (max-width: 900px) {\n' + rules + '\n}';

// [11] 이 '모바일에서 .gnb-nav 가 숨겨진다'고 판정해야 하는 7가지 형태
const HIDING_FORMS = [
  ['1. .gnb-nav 가 목록 앞: .gnb-nav, .gnb-subnav { display: none }', '.gnb-nav, .gnb-subnav { display: none; }'],
  ['2. .gnb-nav 가 목록 뒤: .gnb-subnav, .gnb-nav { display: none }', '.gnb-subnav, .gnb-nav { display: none; }'],
  ['3. 하위 선택자: .gnb .gnb-nav { display: none }', '.gnb .gnb-nav { display: none; }'],
  ['4. 다른 선언과 함께: .gnb-nav { flex:1; display:none }', '.gnb-nav { flex:1; display:none }'],
  ['5. .gnb-nav { visibility: hidden }', '.gnb-nav { visibility: hidden; }'],
  ['6. .gnb-nav { width: 0; overflow: hidden }', '.gnb-nav { width: 0; overflow: hidden; }'],
  ['7. 현재 style.css 형태: .gnb-nav { display: none; }', '.gnb-nav { display: none; }'],
];

describe('cssHidesGnbNavOnMobile: 숨김 7형태', () => {
  HIDING_FORMS.forEach(([name, rule]) => {
    it(name + ' 를 감지한다', () => {
      expect(SYNC.cssHidesGnbNavOnMobile(MOBILE(rule))).toBe(true);
    });
  });

  it('같은 형태가 여러 @media 폭에서도 감지된다 (480/700/900)', () => {
    [480, 700, 900].forEach((w) => {
      const css = '@media (max-width: ' + w + 'px) { .gnb-subnav, .gnb-nav { display: none; } }';
      expect(SYNC.cssHidesGnbNavOnMobile(css), String(w)).toBe(true);
    });
  });

  it('여러 규칙·중첩 중괄호가 있는 블록에서도 .gnb-nav 규칙을 찾는다', () => {
    const css = MOBILE('  .page-layout { grid-template-columns: 1fr; }\n  .sidebar { transform: translateX(-110%); }\n  .gnb-nav, .gnb-subnav { display: none; }');
    expect(SYNC.cssHidesGnbNavOnMobile(css)).toBe(true);
  });

  it('숨김 방식을 알려 준다 (display / visibility / width)', () => {
    expect(SYNC.gnbNavHidingOnMobile(MOBILE('.gnb-nav { display:none }'))).toEqual(['display']);
    expect(SYNC.gnbNavHidingOnMobile(MOBILE('.gnb-nav { visibility: hidden }'))).toEqual(['visibility']);
    expect(SYNC.gnbNavHidingOnMobile(MOBILE('.gnb-nav { width: 0; overflow: hidden }'))).toEqual(['width']);
  });
});

describe('cssHidesGnbNavOnMobile: 숨기지 않는 CSS 는 감지하지 않는다', () => {
  it('빈 CSS·@media 밖의 규칙', () => {
    expect(SYNC.cssHidesGnbNavOnMobile('')).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile('.gnb-nav { display: none; }')).toBe(false);
  });

  it('.gnb-subnav 만 숨기는 규칙은 대상이 아니다 (700px 규칙)', () => {
    expect(SYNC.cssHidesGnbNavOnMobile('@media (max-width: 700px) { .gnb-subnav { display: none; } }')).toBe(false);
  });

  it('이름이 비슷한 다른 클래스는 대상이 아니다 (.gnb-nav-link, .gnb-nav-x, .gnb-navigation)', () => {
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav-link { display: none; }'))).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav-x, .gnb-navigation { display: none; }'))).toBe(false);
  });

  it('.gnb-nav 의 자손·상태 선택자는 대상이 아니다 (.gnb-nav .gnb-nav-link, .gnb-nav:hover)', () => {
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav .gnb-nav-link { display: none; }'))).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav:hover { display: none; }'))).toBe(false);
  });

  it('display:none 이 아닌 값은 숨김이 아니다 (display:flex, visibility:visible, width:100%)', () => {
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav { display: flex; }'))).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav { visibility: visible; }'))).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav { width: 100%; overflow: hidden; }'))).toBe(false);
  });

  it('overflow:hidden 없는 width:0 은 숨김으로 보지 않고, width:0 없는 overflow:hidden 도 아니다', () => {
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav { width: 0; }'))).toBe(false);
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('.gnb-nav { overflow: hidden; }'))).toBe(false);
  });

  it('주석 속에 쓴 규칙은 무시한다', () => {
    expect(SYNC.cssHidesGnbNavOnMobile(MOBILE('/* .gnb-nav { display: none; } */\n.gnb-nav { display: flex; }'))).toBe(false);
  });

  it('min-width 미디어 쿼리 블록은 모바일 규칙이 아니다', () => {
    expect(SYNC.cssHidesGnbNavOnMobile('@media (min-width: 901px) { .gnb-nav { display: none; } }')).toBe(false);
  });
});

describe('cssHidesGnbNavOnMobile: 알 수 없는 숨김은 조용히 통과하지 않는다 (fail-closed)', () => {
  [
    ['opacity:0', '.gnb-nav { opacity: 0; }'],
    ['height:0', '.gnb-nav { height: 0; }'],
    ['font-size:0', '.gnb-nav { font-size: 0; }'],
    ['clip-path', '.gnb-nav { clip-path: inset(50%); }'],
    ['화면 밖 이동', '.gnb-nav { position: absolute; left: -9999px; }'],
  ].forEach(([name, rule]) => {
    it(name + ' 는 숨김 의심으로 감지한다', () => {
      expect(SYNC.cssHidesGnbNavOnMobile(MOBILE(rule))).toBe(true);
      expect(SYNC.gnbNavHidingOnMobile(MOBILE(rule))).toEqual(['suspect']);
    });
  });
});

describe('실제 CSS: 판정 결과는 바뀌지 않는다', () => {
  const sharedCss = fs.readFileSync(path.join(ROOT, 'shared', 'style.css'), 'utf8');

  it('shared/style.css 의 @media (max-width: 900px) { .gnb-nav { display: none } } 를 감지한다', () => {
    // 이것이 false 가 되면 [11] 이 '조용히 통과'한다 — baseline 12건이 사라지는 쪽으로 무너지기 때문에 여기서 잡는다.
    expect(SYNC.cssHidesGnbNavOnMobile(sharedCss)).toBe(true);
    expect(SYNC.gnbNavHidingOnMobile(sharedCss)).toEqual(['display']);
  });

  it('shared/style.css 를 쓰는 11개 페이지는 드로어 마커로 4개 라벨을 채워 [11] mobile-menu 사유가 사라진다', () => {
    // PR-B 이전에는 11개 모두 mobile-menu 사유였다. 숨김 감지(위 테스트)가 살아 있는 채로 사유가 사라지는 것이 정상.
    const files = Object.keys(require('../shared/nav-definition.js').PAGE_MAP)
      .filter((f) => /shared\/style\.css/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(files).toHaveLength(11);
    files.forEach((f) => {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const { reasons, details } = SYNC.inspectPage(html, f, ROOT);
      expect(reasons, f).not.toContain('mobile-menu');
      expect(details.mobileMissing, f).toHaveLength(0);
    });
  });
});
