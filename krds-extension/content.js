/**
 * KRDS 인라인 지적 — content script (1차 구현: 규칙 기반, AI 계약은 별도 스파이크)
 *
 * 설계: 7457948-main-design-20260819.md (Approach B)
 * 범위: textarea 대상 mirror overlay 방식 (ET1 결정 — 실제 데모 대상이 전부
 * textarea라 CSS Custom Highlight API(contenteditable 전용)는 적용 불가).
 *
 * mirror overlay는 textarea의 value/DOM을 전혀 건드리지 않는다 — 브라우저
 * 네이티브 undo 스택을 보존한다 (Design Review T2 CRITICAL 대응).
 *
 * 이번 1차 구현은 krds-lint.js 규칙 엔진만 사용한다 — AI 인라인 검사 API
 * 계약(Next Steps #1)은 별도 스파이크로 미룬다. 기존 lint 규칙만으로도
 * "에디터 내 즉시 지적" 핵심 체험을 시연할 수 있고, AI 계층은 이 위에
 * 얹는 구조로 설계했다(krds-lint 결과를 우선 표시, AI 판단은 추가 레이어).
 */
(function () {
  'use strict';

  var TARGET_SELECTOR = '#inputText';
  var DEBOUNCE_MS = 400;
  var MAX_MARKS_PER_LINE = 2; // Design Review Pass 3 — 밑줄 밀도가 "무심한 타이핑" 목표를 깨뜨리지 않도록 제한

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function computeLineOffsets(lines) {
    var offsets = [];
    var acc = 0;
    for (var i = 0; i < lines.length; i++) {
      offsets.push(acc);
      acc += lines[i].length + 1; // +1 for '\n'
    }
    return offsets;
  }

  function attach(textarea) {
    if (textarea.dataset.krdsInlineLintAttached) return;
    textarea.dataset.krdsInlineLintAttached = '1';

    var wrap = textarea.closest('.textarea-wrap') || textarea.parentElement;
    if (!wrap) return;
    if (getComputedStyle(wrap).position === 'static') {
      wrap.style.position = 'relative';
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'krds-inline-lint-backdrop';
    wrap.insertBefore(backdrop, textarea);

    var highlightsLayer = document.createElement('div');
    highlightsLayer.className = 'krds-inline-lint-highlights';
    backdrop.appendChild(highlightsLayer);

    var statusDot = document.createElement('div');
    statusDot.className = 'krds-inline-lint-status';
    statusDot.setAttribute('aria-hidden', 'true');
    wrap.appendChild(statusDot);

    var liveRegion = document.createElement('div');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    wrap.appendChild(liveRegion);

    textarea.classList.add('krds-inline-lint-input');

    var marks = [];
    var popover = createPopover();

    syncStyles();

    var debounceTimer = null;
    function scheduleLint() {
      // 텍스트가 바뀌면 열려 있던 팝오버의 m.start/m.end가 즉시 낡은 값이
      // 된다 — 그대로 두면 사용자가 팝오버를 연 뒤 다른 곳을 typing하고
      // 돌아와 "적용"을 눌렀을 때 엉뚱한 구간이 교체될 수 있다
      // (2026-08-20 codex 리뷰 P2). 재검사를 기다릴 것 없이 즉시 닫는다.
      hidePopover();
      statusDot.classList.add('krds-checking');
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runLint, DEBOUNCE_MS);
    }

    textarea.addEventListener('input', scheduleLint);
    textarea.addEventListener('scroll', syncScroll);
    window.addEventListener('resize', syncStyles);
    if (window.ResizeObserver) {
      new ResizeObserver(syncStyles).observe(textarea);
    }

    // lint.html의 샘플/초기화/기록 복원 버튼은 textarea.value를 직접
    // 대입하고 네이티브 'input' 이벤트를 발생시키지 않는다 — page-hook.js
    // (MAIN world content script)가 대입 시점에 쏘는 커스텀 이벤트를
    // 구독해서 감지한다. isolated world인 이 스크립트에서 textarea
    // 인스턴스에 직접 defineProperty를 걸면 페이지 자체 코드(lint-ui.js)가
    // 쓰는 MAIN world 래퍼와 다른 객체가 되어 전혀 감지되지 않는다
    // (2026-08-20 codex 리뷰 P2 — 최초 접근은 isolated world 내부에서만
    // 테스트해 통과로 오판했음. page-hook.js 참고).
    textarea.addEventListener('krds:value-changed', scheduleLint);

    // 옵션 칩(행정어 검사/패턴 규칙 검사) 토글 시에도 다시 검사 — 텍스트를
    // 안 바꾸고 옵션만 꺼도/켜도 인라인 지적이 즉시 반영되도록 함.
    document.querySelectorAll('.opt-chip[data-opt]').forEach(function (chip) {
      chip.addEventListener('click', scheduleLint);
    });

    runLint();

    function syncStyles() {
      var cs = getComputedStyle(textarea);
      [
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
        'textAlign', 'wordSpacing', 'whiteSpace', 'wordBreak', 'overflowWrap', 'boxSizing',
      ].forEach(function (prop) {
        highlightsLayer.style[prop] = cs[prop];
      });
      backdrop.style.width = textarea.offsetWidth + 'px';
      backdrop.style.height = textarea.offsetHeight + 'px';
      syncScroll();
    }

    function syncScroll() {
      highlightsLayer.style.transform = 'translate(' + (-textarea.scrollLeft) + 'px,' + (-textarea.scrollTop) + 'px)';
    }

    function isOptChecked(optName) {
      var chip = document.querySelector('.opt-chip[data-opt="' + optName + '"]');
      // 칩을 못 찾으면(페이지 구조 변경 등) 기본값 true로 안전하게 폴백
      return chip ? chip.getAttribute('aria-checked') === 'true' : true;
    }

    function runLint() {
      statusDot.classList.remove('krds-checking');
      var text = textarea.value;
      if (!text) {
        render(text, []);
        liveRegion.textContent = '';
        return;
      }
      if (!window.KRDSLint) return;
      // 페이지 자체의 "행정어 검사"/"패턴 규칙 검사" 옵션 칩 상태를 그대로
      // 따른다 — 켜져있지 않으면 지적 표시도 하지 않는다
      // (2026-08-20 codex 리뷰 P2 — 옵션을 꺼도 인라인 밑줄만 계속 뜨던 문제).
      var result = window.KRDSLint.lint(text, {
        checkAdminJargon: isOptChecked('checkAdminJargon'),
        checkPatterns: isOptChecked('checkPatterns'),
      });
      var issues = (result && result.issues) || [];
      render(text, issues);
      liveRegion.textContent = issues.length
        ? ('KRDS 원칙 위반 ' + issues.length + '건 발견')
        : '위반 없음';
    }

    function render(text, issues) {
      var lines = text.split('\n');
      var offsets = computeLineOffsets(lines);
      var perLineCount = {};

      var candidates = issues
        .filter(function (i) { return i.severity === 'error' || i.severity === 'warning'; })
        .map(function (i) {
          var base = offsets[i.line - 1] || 0;
          var start = base + (i.col - 1);
          var end = start + (i.match ? i.match.length : 0);
          return { start: start, end: end, issue: i };
        })
        .filter(function (m) { return m.end > m.start; })
        .sort(function (a, b) { return a.start - b.start; });

      marks = [];
      candidates.forEach(function (m) {
        var lineIdx = m.issue.line - 1;
        var count = perLineCount[lineIdx] || 0;
        if (count >= MAX_MARKS_PER_LINE) return; // 밑줄 밀도 제한
        if (marks.length && m.start < marks[marks.length - 1].end) return; // 겹침 방지
        perLineCount[lineIdx] = count + 1;
        marks.push(m);
      });

      var html = '';
      var cursor = 0;
      marks.forEach(function (m, idx) {
        html += escapeHtml(text.slice(cursor, m.start));
        html +=
          '<mark class="krds-inline-lint-mark krds-sev-' + m.issue.severity + '" ' +
          'data-idx="' + idx + '" tabindex="0" role="button" ' +
          'aria-label="' + escapeHtml(m.issue.category || m.issue.type || 'KRDS 원칙 위반') + '">' +
          escapeHtml(text.slice(m.start, m.end)) +
          '</mark>';
        cursor = m.end;
      });
      html += escapeHtml(text.slice(cursor));
      // textarea는 항상 마지막에 빈 줄 하나를 더 표시하므로 오버레이도 맞춰준다
      highlightsLayer.innerHTML = html + '\n';
    }

    function createPopover() {
      var el = document.createElement('div');
      el.className = 'krds-inline-lint-popover';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'KRDS 원칙 위반 상세');
      el.hidden = true;
      document.body.appendChild(el);
      return el;
    }

    function showPopover(markEl, m) {
      var issue = m.issue;
      popover.innerHTML = '';

      var problem = document.createElement('div');
      problem.className = 'krds-popover-problem';
      problem.textContent = '문제: ' + (issue.category || issue.type);

      var rationale = document.createElement('div');
      rationale.className = 'krds-popover-rationale';
      rationale.textContent = issue.message || '';

      popover.appendChild(problem);
      popover.appendChild(rationale);

      if (issue.suggestion) {
        var alt = document.createElement('div');
        alt.className = 'krds-popover-alt';
        alt.textContent = '대안: ' + String(issue.suggestion).replace(/^→\s*/, '');
        popover.appendChild(alt);
      }

      // 행정어 사전 중 "단순 1:1 치환"으로 판별된 항목만 적용 버튼을 보여준다
      // (krds-lint.js의 isSimpleReplacement — 패턴 규칙의 alt는 전부 예시
      // 나열형이라 원천적으로 applyable: false). 텍스트 교체는
      // execCommand('insertText')로 실행해 네이티브 undo/redo를 보존한다
      // (2026-08-20 TODO-026 — Playwright로 Ctrl+Z/Ctrl+Shift+Z 검증 완료).
      if (issue.applyable && issue.applyText) {
        var applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'krds-popover-apply';
        applyBtn.textContent = '적용';
        applyBtn.addEventListener('click', function () {
          // scheduleLint의 input 리스너가 텍스트 변경 시 팝오버를 즉시 닫지만,
          // 이중 안전장치로 교체 직전에도 그 구간이 여전히 이 이슈가 잡았던
          // 문구와 정확히 같은지 확인한다 — 다르면 조용히 아무 것도 하지 않는다
          // (2026-08-20 codex 리뷰 P2 — 낡은 offset으로 엉뚱한 구간을 지우는 것 방지).
          if (textarea.value.slice(m.start, m.end) !== issue.match) {
            hidePopover();
            return;
          }
          textarea.focus();
          textarea.setSelectionRange(m.start, m.end);
          document.execCommand('insertText', false, issue.applyText);
          hidePopover();
        });
        popover.appendChild(applyBtn);
      }

      var rect = markEl.getBoundingClientRect();
      // 먼저 화면 밖(hidden 유지)에서 실제 크기를 잰다 — 크기를 알아야
      // 아래/위 배치와 클리핑을 정확히 계산할 수 있다.
      popover.style.visibility = 'hidden';
      popover.hidden = false;
      var popoverHeight = popover.offsetHeight;
      var popoverWidth = popover.offsetWidth;

      // 뷰포트 아래쪽에 공간이 부족하면 밑줄 위쪽에 배치
      // (2026-08-20 codex 리뷰 P2 — 화면 하단 근처 지적은 팝오버가 아예
      // 뷰포트 밖으로 나가 근거/대안이 안 보이던 문제).
      var spaceBelow = window.innerHeight - rect.bottom;
      var top = spaceBelow >= popoverHeight + 8
        ? window.scrollY + rect.bottom + 4
        : window.scrollY + rect.top - popoverHeight - 4;
      top = Math.max(window.scrollY + 8, top);

      var left = window.scrollX + rect.left;
      var maxLeft = window.scrollX + document.documentElement.clientWidth - popoverWidth - 8;
      left = Math.min(left, Math.max(window.scrollX + 8, maxLeft));

      popover.style.top = top + 'px';
      popover.style.left = left + 'px';
      popover.style.visibility = '';
    }

    function hidePopover() {
      popover.hidden = true;
    }

    function markAt(idx) {
      return marks[idx];
    }

    highlightsLayer.addEventListener('click', function (e) {
      var markEl = e.target.closest('mark.krds-inline-lint-mark');
      if (!markEl) return;
      var m = markAt(Number(markEl.dataset.idx));
      if (m) showPopover(markEl, m);
    });

    // 키보드 접근성 — Tab으로 밑줄 이동, Enter/Space로 팝오버, Esc로 닫기
    highlightsLayer.addEventListener('keydown', function (e) {
      var markEl = e.target.closest('mark.krds-inline-lint-mark');
      if (!markEl) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var m = markAt(Number(markEl.dataset.idx));
        if (m) showPopover(markEl, m);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !popover.hidden) hidePopover();
    });

    document.addEventListener('click', function (e) {
      if (popover.hidden) return;
      if (popover.contains(e.target)) return;
      if (e.target.closest && e.target.closest('mark.krds-inline-lint-mark')) return;
      hidePopover();
    });
  }

  function init() {
    var textarea = document.querySelector(TARGET_SELECTOR);
    if (textarea) attach(textarea);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
