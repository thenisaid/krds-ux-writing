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
    textarea.addEventListener('input', function () {
      statusDot.classList.add('krds-checking');
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runLint, DEBOUNCE_MS);
    });
    textarea.addEventListener('scroll', syncScroll);
    window.addEventListener('resize', syncStyles);
    if (window.ResizeObserver) {
      new ResizeObserver(syncStyles).observe(textarea);
    }

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

    function runLint() {
      statusDot.classList.remove('krds-checking');
      var text = textarea.value;
      if (!text) {
        render(text, []);
        liveRegion.textContent = '';
        return;
      }
      if (!window.KRDSLint) return;
      var result = window.KRDSLint.lint(text, { checkAdminJargon: true, checkPatterns: true });
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

    function showPopover(markEl, issue) {
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

      var rect = markEl.getBoundingClientRect();
      popover.style.left = window.scrollX + rect.left + 'px';
      popover.style.top = window.scrollY + rect.bottom + 4 + 'px';
      popover.hidden = false;

      // 뷰포트 가장자리 클리핑 방지 (Design Review Pass 7)
      var maxLeft = window.scrollX + document.documentElement.clientWidth - popover.offsetWidth - 8;
      if (parseFloat(popover.style.left) > maxLeft) {
        popover.style.left = Math.max(8, maxLeft) + 'px';
      }
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
      if (m) showPopover(markEl, m.issue);
    });

    // 키보드 접근성 — Tab으로 밑줄 이동, Enter/Space로 팝오버, Esc로 닫기
    highlightsLayer.addEventListener('keydown', function (e) {
      var markEl = e.target.closest('mark.krds-inline-lint-mark');
      if (!markEl) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var m = markAt(Number(markEl.dataset.idx));
        if (m) showPopover(markEl, m.issue);
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
