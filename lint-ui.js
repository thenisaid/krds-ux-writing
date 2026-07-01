(function () {
  'use strict';

  // ── 테마 ──
  function prefersDarkScheme() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function syncThemeToggle(theme) {
    if (!themeToggle) return;
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? '라이트모드 전환' : '다크모드 전환');
  }

  var themeToggle = document.getElementById('themeToggle');
  var inputText = document.getElementById('inputText');
  var sampleBtn = document.getElementById('sampleBtn');
  var clearBtn = document.getElementById('clearBtn');
  var scoreSection = document.getElementById('scoreSection');
  var highlightCard = document.getElementById('highlightCard');
  var issuesCard = document.getElementById('issuesCard');
  var improvedCard = document.getElementById('improvedCard');
  var highlightedText = document.getElementById('highlightedText');
  var issuesList = document.getElementById('issuesList');
  var issuesTitle = document.getElementById('issuesTitle');
  var lintBtn = document.getElementById('lintBtn');
  var copyBtn = document.getElementById('copyBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var shareLinkBtn = document.getElementById('shareLinkBtn');
  var improvedText = document.getElementById('improvedText');
  var copyImprovedBtn = document.getElementById('copyImprovedBtn');
  var historyCard = document.getElementById('historyCard');
  var historyList = document.getElementById('historyList');
  var clearHistoryBtn = document.getElementById('clearHistoryBtn');
  var cliBanner = document.getElementById('cliBanner');
  var cliBannerClose = document.getElementById('cliBannerClose');
  var copyCliBtn = document.getElementById('copyCliBtn');
  var charCount = document.getElementById('charCount');
  var toastEl = document.getElementById('toast');
  var optChips = Array.from(document.querySelectorAll('.opt-chip'));
  var filterTabs = Array.from(document.querySelectorAll('.filter-tab'));

  var requiredNodes = [
    themeToggle,
    inputText,
    sampleBtn,
    clearBtn,
    scoreSection,
    highlightCard,
    issuesCard,
    improvedCard,
    highlightedText,
    issuesList,
    issuesTitle,
    lintBtn,
    copyBtn,
    downloadBtn,
    shareLinkBtn,
    improvedText,
    copyImprovedBtn,
    historyCard,
    historyList,
    clearHistoryBtn,
    cliBanner,
    cliBannerClose,
    copyCliBtn,
    charCount,
    toastEl
  ];

  if (requiredNodes.some(function (node) { return !node; })) return;

  var savedTheme = (function() {
    try { return localStorage.getItem('krds-theme'); } catch(e) { return null; }
  })();
  var initialTheme = (savedTheme === 'dark' || (!savedTheme && prefersDarkScheme())) ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', initialTheme);
  syncThemeToggle(initialTheme);
  themeToggle.addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    syncThemeToggle(next);
    try { localStorage.setItem('krds-theme', next); } catch(e) {}
  });

  // ── 옵션 칩 ──
  var opts = { checkAdminJargon: true, checkPatterns: true };
  var analysisDirty = false;
  optChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = this.dataset.opt;
      opts[key] = !opts[key];
      this.classList.toggle('active', opts[key]);
      this.setAttribute('aria-checked', opts[key] ? 'true' : 'false');
      invalidateAnalysis();
    });
    chip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
    });
  });

  // ── 문자 카운터 ──
  inputText.addEventListener('input', function () {
    charCount.textContent = this.value.length;
    invalidateAnalysis();
  });

  // ── 샘플 텍스트 ──
  var SAMPLE = [
    '귀하의 소득 및 재산 현황을 검토한 결과, 지원 대상에 해당되지 않음을 알려드립니다.',
    'ERROR 4023: 인증 실패. 다시 시도해 주세요.',
    '더욱 빠르게, 간편하게, 안전하게 처리되시겠습니다!!!',
    '해당 파일이 업로드되어지다. 잠시 후 다시 시도해 주세요.',
    '수급권자는 소명자료를 첨부하여 제출하시기 바랍니다.',
    '귀책사유가 없는 경우 변상금 부과가 면제됩니다.',
  ].join('\n');

  sampleBtn.addEventListener('click', function () {
    inputText.value = SAMPLE;
    charCount.textContent = SAMPLE.length;
    invalidateAnalysis();
  });

  // ── 초기화 ──
  clearBtn.addEventListener('click', function () {
    inputText.value = '';
    charCount.textContent = '0';
    analysisDirty = false;
    resetAnalysisUi();
  });

  function emptyPlaceholder() {
    return '<div class="empty-state"><div class="empty-icon" aria-hidden="true">📋</div>' +
      '<div class="empty-title">텍스트를 입력하고 검사해 주세요</div>' +
      '<div class="empty-desc">품질 점수와 이슈 목록이 여기에 표시됩니다</div></div>';
  }

  // ── 린팅 ──
  var lastResult = null;
  var currentFilter = 'all';

  function resetFilterTabs() {
    filterTabs.forEach(function (tab) {
      var isAll = tab.dataset.filter === 'all';
      tab.classList.toggle('active', isAll);
      tab.setAttribute('aria-pressed', isAll ? 'true' : 'false');
    });
    currentFilter = 'all';
  }

  function resetAnalysisUi() {
    lastResult = null;
    scoreSection.innerHTML = emptyPlaceholder();
    highlightCard.style.display = 'none';
    issuesCard.style.display = 'none';
    improvedCard.style.display = 'none';
    cliBanner.style.display = 'none';
    highlightedText.innerHTML = '';
    issuesList.innerHTML = '';
    issuesTitle.textContent = '이슈 목록';
    improvedText.textContent = '';
    resetFilterTabs();
    updateShareBtn();
  }

  function invalidateAnalysis() {
    if (!lastResult) {
      updateShareBtn();
      return;
    }
    analysisDirty = true;
    resetAnalysisUi();
  }

  function applyLintResult(text, result) {
    lastResult = result;
    analysisDirty = false;
    renderScore(lastResult);
    renderHighlight(text, lastResult.issues);
    renderIssues(lastResult.issues);
    renderImproved(text, lastResult.issues);
    saveHistory(text, lastResult.score, lastResult.issues.length);
    renderHistory();
    renderCliBanner(lastResult.score, text.length);
    updateShareBtn();
  }

  function handleLintFailure(options) {
    lastResult = null;
    analysisDirty = false;
    resetAnalysisUi();
    if (!options || options.showToast !== false) {
      showToast('❌ 검사 중 오류가 발생했습니다. 다시 시도해 주세요');
    }
  }

  function runLintAnalysis(text, options) {
    if (typeof KRDSLint === 'undefined' || !KRDSLint || typeof KRDSLint.lint !== 'function') {
      handleLintFailure(options);
      return false;
    }

    try {
      applyLintResult(text, KRDSLint.lint(text, opts));
      return true;
    } catch (e) {
      handleLintFailure(options);
      return false;
    }
  }

  lintBtn.addEventListener('click', function () {
    var text = inputText.value.trim();
    if (!text) {
      inputText.focus();
      return;
    }
    runLintAnalysis(text);
  });

  // ── 점수 렌더 ──
  function renderScore(result) {
    var s = result.score;
    var circumference = 2 * Math.PI * 42;
    var offset = circumference * (1 - s / 100);
    var colorClass = s >= 80 ? 'score-good' : s >= 50 ? 'score-warning' : 'score-danger';
    var desc = s >= 80 ? '좋음' : s >= 50 ? '개선 필요' : '주의 필요';
    var descColor = s >= 80 ? 'var(--color-success-50)' : s >= 50 ? 'var(--color-warning-50)' : 'var(--color-danger-50)';

    scoreSection.innerHTML =
      '<div class="score-ring" aria-label="품질 점수 ' + s + '점">' +
        '<svg width="100" height="100" viewBox="0 0 100 100">' +
          '<circle class="track" cx="50" cy="50" r="42" stroke-dasharray="' + circumference + '" stroke-dashoffset="0"/>' +
          '<circle class="fill ' + colorClass + '" cx="50" cy="50" r="42"' +
            ' stroke-dasharray="' + circumference + '"' +
            ' stroke-dashoffset="' + offset + '"' +
          '/>' +
        '</svg>' +
        '<div class="score-num">' + s + '</div>' +
      '</div>' +
      '<div class="score-label">/100점</div>' +
      '<div class="score-desc" style="color:' + descColor + '">' + desc + '</div>' +
      '<div class="stat-row">' +
        '<div class="stat-badge stat-error"><div class="num">' + result.summary.errors + '</div><div class="lbl">오류</div></div>' +
        '<div class="stat-badge stat-warning"><div class="num">' + result.summary.warnings + '</div><div class="lbl">경고</div></div>' +
        '<div class="stat-badge stat-info"><div class="num">' + result.summary.infos + '</div><div class="lbl">안내</div></div>' +
      '</div>';
  }

  // ── 하이라이트 렌더 ──
  function renderHighlight(text, issues) {
    var card = highlightCard;
    if (!issues.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    // 오프셋 기반 마킹
    var lines = text.split('\n');
    // Build offset map per line
    var marked = lines.map(function (line, lineIdx) {
      var lineIssues = issues.filter(function (i) { return i.line === lineIdx + 1; });
      if (!lineIssues.length) return escapeHtml(line);

      // 겹치지 않게 정렬
      lineIssues.sort(function (a, b) { return a.col - b.col; });
      var result = '';
      var pos = 0;
      lineIssues.forEach(function (issue) {
        var start = issue.col - 1;
        var end = start + issue.match.length;
        if (start < pos) return;
        result += escapeHtml(line.slice(pos, start));
        result += '<mark class="hl-' + issue.severity + '" title="' +
          escapeAttr(issue.message) + '">' +
          escapeHtml(line.slice(start, end)) + '</mark>';
        pos = end;
      });
      result += escapeHtml(line.slice(pos));
      return result;
    });

    highlightedText.innerHTML = marked.join('\n');
  }

  // ── 이슈 목록 렌더 ──
  function renderIssues(issues) {
    var card = issuesCard;
    if (!issues.length) {
      card.style.display = 'block';
      issuesList.innerHTML =
        '<div class="empty-state empty-success">' +
          '<div class="empty-icon" aria-hidden="true">✅</div>' +
          '<div class="empty-title">이슈가 없습니다!</div>' +
          '<div class="empty-desc">KRDS UX 라이팅 가이드라인을 준수하고 있습니다.</div>' +
        '</div>';
      issuesTitle.textContent = '이슈 없음';
      return;
    }
    card.style.display = 'block';
    issuesTitle.textContent = '이슈 목록 (' + issues.length + '건)';
    renderFilteredIssues(issues, currentFilter);
  }

  function renderFilteredIssues(issues, filter) {
    var filtered = filter === 'all' ? issues : issues.filter(function (i) { return i.severity === filter; });
    var html = '';
    filtered.forEach(function (issue) {
      var sevLabel = { error: '오류', warning: '경고', info: '안내' }[issue.severity] || issue.severity;
      html += '<div class="issue-item sev-' + issue.severity + '" role="listitem">' +
        '<div class="issue-row1">' +
          '<span class="issue-sev">' + sevLabel + '</span>' +
          '<span class="issue-cat">' + escapeHtml(issue.category) + '</span>' +
          '<span class="issue-pos">' + issue.line + '줄 ' + issue.col + '열</span>' +
        '</div>' +
        '<div class="issue-msg">' +
          escapeHtml(issue.message.replace('"' + issue.match + '"', '')) +
          '<span class="issue-match">' + escapeHtml(issue.match) + '</span>' +
        '</div>' +
        '<div class="issue-suggest">' + escapeHtml(issue.suggestion) + '</div>' +
      '</div>';
    });
    issuesList.innerHTML = html || '<div class="empty-state"><div class="empty-desc">선택한 필터에 이슈가 없습니다.</div></div>';
  }

  // 필터 탭
  filterTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      currentFilter = this.dataset.filter;
      filterTabs.forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-pressed', 'true');
      if (lastResult) renderFilteredIssues(lastResult.issues, currentFilter);
    });
  });

  // ── 결과 복사 ──
  function hasAsyncClipboard() {
    return !!(
      navigator &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    );
  }

  function buildCliFallback(result) {
    if (!result || typeof result !== 'object') return '';

    var summary = result.summary && typeof result.summary === 'object'
      ? result.summary
      : {};
    var issues = Array.isArray(result.issues) ? result.issues : [];
    var lines = [
      'KRDS UX Writing 검사 결과',
      '품질 점수: ' + Number(result.score || 0) + '/100',
      '오류: ' + Number(summary.errors || 0) +
        ' / 경고: ' + Number(summary.warnings || 0) +
        ' / 안내: ' + Number(summary.infos || 0),
      '',
    ];

    if (!issues.length) {
      lines.push('이슈 없음');
      return lines.join('\n');
    }

    issues.forEach(function (issue, index) {
      if (!issue || typeof issue !== 'object') return;
      lines.push(
        (index + 1) + '. [' + String(issue.severity || 'info') + '] ' +
          Number(issue.line || 0) + '줄 ' + Number(issue.col || 0) + '열'
      );
      lines.push('카테고리: ' + String(issue.category || ''));
      lines.push('메시지: ' + String(issue.message || ''));
      lines.push('검출어: ' + String(issue.match || ''));
      lines.push('제안: ' + String(issue.suggestion || ''));
      lines.push('');
    });

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function formatResultForClipboard(result) {
    if (typeof KRDSLint !== 'undefined' && KRDSLint && typeof KRDSLint.formatCLI === 'function') {
      var formatted = KRDSLint.formatCLI(result);
      if (typeof formatted === 'string' && formatted.trim()) {
        return formatted;
      }
    }

    return buildCliFallback(result);
  }

  copyBtn.addEventListener('click', function () {
    if (!lastResult) return;
    var text = '';
    try {
      text = formatResultForClipboard(lastResult);
    } catch (e) {
      showToast('❌ 결과 복사 형식을 만들지 못했습니다');
      return;
    }
    if (!text) {
      showToast('❌ 결과 복사 형식을 만들지 못했습니다');
      return;
    }
    var btn = this;
    var actionId = (btn._copyActionId || 0) + 1;
    btn._copyActionId = actionId;
    var origHtml = '<span aria-hidden="true">📋</span> 결과 복사';
    function isLatestAction() {
      return btn._copyActionId === actionId;
    }
    function queueReset() {
      if (!isLatestAction()) return;
      if (btn._copyResetTimer) clearTimeout(btn._copyResetTimer);
      btn._copyResetTimer = setTimeout(function () {
        btn.innerHTML = origHtml;
        btn._copyResetTimer = null;
      }, 2000);
    }
    function legacyCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      if (!isLatestAction()) return;
      btn.textContent = ok ? '✅ 복사됨' : '❌ 복사 실패';
      queueReset();
    }
    if (hasAsyncClipboard()) {
      navigator.clipboard.writeText(text).then(function () {
        if (!isLatestAction()) return;
        btn.textContent = '✅ 복사됨';
        queueReset();
      }).catch(legacyCopy);
    } else {
      legacyCopy();
    }
  });

  // ── CSV 내보내기 ──
  downloadBtn.addEventListener('click', function () {
    if (!lastResult || !lastResult.issues.length) return;
    var url = '';
    var anchor = null;
    try {
      if (!URL || typeof URL.createObjectURL !== 'function') {
        throw new Error('blob-url-unavailable');
      }
      if (!document.body || typeof document.body.appendChild !== 'function' || typeof document.body.removeChild !== 'function') {
        throw new Error('download-body-unavailable');
      }

      var rows = [['줄', '열', '심각도', '카테고리', '메시지', '검출어', '제안']];
      lastResult.issues.forEach(function (i) {
        rows.push([i.line, i.col, i.severity, i.category, i.message, i.match, i.suggestion]);
      });
      var csv = rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\n');
      var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      url = URL.createObjectURL(blob);
      anchor = document.createElement('a');
      if (!anchor || typeof anchor.click !== 'function') {
        throw new Error('download-anchor-unavailable');
      }
      anchor.href = url;
      anchor.download = 'krds-lint-result.csv';
      document.body.appendChild(anchor);
      anchor.click();
    } catch (e) {
      showToast('❌ CSV 다운로드에 실패했습니다');
    } finally {
      if (anchor && document.body && typeof document.body.removeChild === 'function') {
        try { document.body.removeChild(anchor); } catch (e) {}
      }
      if (url && URL && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }
  });

  // ── CSV 내보내기 이후 추가 기능들 ──

  // ── 토스트 ──
  var toastActionId = 0;

  function reserveToastAction() {
    toastActionId += 1;
    return toastActionId;
  }

  function isLatestToastAction(actionId) {
    return actionId === toastActionId;
  }

  function showToast(msg, actionId) {
    if (typeof actionId === 'number') {
      if (!isLatestToastAction(actionId)) return;
    } else {
      actionId = reserveToastAction();
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () {
      if (!isLatestToastAction(actionId)) return;
      toastEl.classList.remove('show');
    }, 2000);
  }

  // ── 결과 링크 복사 ──
  function updateShareBtn() {
    var text = inputText.value.trim();
    var btn = shareLinkBtn;
    if (!lastResult) {
      btn.disabled = true;
      btn.title = analysisDirty ? '텍스트가 변경되었습니다. 다시 검사해 주세요' : '먼저 검사를 실행해 주세요';
      return;
    }
    if (text.length > 500) {
      btn.disabled = true;
      btn.title = '텍스트가 500자를 초과하면 URL 공유를 사용할 수 없습니다';
    } else {
      btn.disabled = false;
      btn.title = '';
    }
  }

  shareLinkBtn.addEventListener('click', function () {
    var text = inputText.value.trim();
    if (!text || text.length > 500) {
      showToast('⚠️ 500자 이하 텍스트만 링크로 공유할 수 있습니다');
      return;
    }
    var url = '';
    try {
      var shareUrl = new URL(window.location.href);
      shareUrl.search = '';
      shareUrl.hash = '';
      shareUrl.searchParams.set('t', text);
      url = shareUrl.toString();
    } catch (_) {
      var fallbackBase = String(window.location && window.location.href || '')
        .split('#')[0]
        .split('?')[0];
      url = fallbackBase + '?t=' + encodeURIComponent(text);
    }
    copyWithToast(url, '✅ 링크가 클립보드에 복사되었습니다', '❌ 링크 복사에 실패했습니다');
  });

  function copyFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    if (typeof ta.select === 'function') ta.select();
    var ok = false;
    try { ok = typeof document.execCommand === 'function' && document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    return !!ok;
  }

  function copyWithToast(text, successMsg, failureMsg) {
    var actionId = reserveToastAction();
    if (hasAsyncClipboard()) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(successMsg, actionId);
      }).catch(function () {
        showToast(copyFallback(text) ? successMsg : failureMsg, actionId);
      });
      return;
    }

    showToast(copyFallback(text) ? successMsg : failureMsg, actionId);
  }

  // ── 유틸 ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getLastHangulCharCode(value) {
    var text = String(value || '');
    for (var i = text.length - 1; i >= 0; i--) {
      var code = text.charCodeAt(i);
      if (code >= 0xAC00 && code <= 0xD7A3) {
        return code;
      }
    }
    return 0;
  }

  function closestIfPossible(node, selector) {
    return node && typeof node.closest === 'function' ? node.closest(selector) : null;
  }

  function pickPrimarySuggestion(suggestion) {
    var value = String(suggestion || '').replace(/^→\s*/, '').trim();
    var depth = 0;

    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (ch === '(' || ch === '[' || ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth === 0 && (ch === '/' || ch === ',')) {
        return value.slice(0, i).trim();
      }
    }

    return value;
  }

  function correctParticleForReplacement(replacement, particle) {
    if (!particle) return '';

    var lastCode = getLastHangulCharCode(replacement);
    var isKorean = lastCode >= 0xAC00 && lastCode <= 0xD7A3;
    var jongseongIndex = isKorean ? (lastCode - 0xAC00) % 28 : 0;
    var hasBatchim = isKorean && jongseongIndex !== 0;

    if (isKorean && (particle === '로' || particle === '으로')) {
      return jongseongIndex === 0 || jongseongIndex === 8 ? '로' : '으로';
    }
    if (hasBatchim) {
      return ({'\uAC00':'\uC774','\uB97C':'\uC744','\uB294':'\uC740','\uC640':'\uACFC'})[particle] || particle;
    }
    if (isKorean) {
      return ({'\uC774':'\uAC00','\uC744':'\uB97C','\uC740':'\uB294','\uACFC':'\uC640'})[particle] || particle;
    }

    return particle;
  }

  function readTrailingParticle(text, startIndex) {
    var source = String(text || '').slice(startIndex);
    var particles = ['으로', '가', '를', '는', '로', '와', '이', '을', '은', '과'];

    for (var i = 0; i < particles.length; i++) {
      if (source.indexOf(particles[i]) === 0) {
        return particles[i];
      }
    }

    return '';
  }

  // ── US-L02: Before/After 개선문 ──
  function renderImproved(text, issues) {
    var card = improvedCard;
    // Only replace admin-jargon issues (PRD: 감지된 행정어만 교체)
    var jargonIssues = issues.filter(function(i) { return i.type === 'admin-jargon' && i.match && i.suggestion; });
    if (!jargonIssues.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    var lines = String(text || '').split('\n');
    var issuesByLine = Object.create(null);

    jargonIssues.forEach(function(issue) {
      var line = Number(issue.line);
      var col = Number(issue.col);
      var match = String(issue.match || '');
      var replacement = pickPrimarySuggestion(issue.suggestion);
      if (!isFinite(line) || !isFinite(col) || line < 1 || col < 1 || !match || !replacement) {
        return;
      }
      if (!issuesByLine[line]) {
        issuesByLine[line] = [];
      }
      issuesByLine[line].push({
        col: col,
        match: match,
        replacement: replacement,
      });
    });

    Object.keys(issuesByLine).forEach(function(lineKey) {
      var lineIndex = Number(lineKey) - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      var lineText = lines[lineIndex];
      issuesByLine[lineKey]
        .sort(function(a, b) { return b.col - a.col; })
        .forEach(function(issue) {
          var start = issue.col - 1;
          if (start < 0 || start > lineText.length) return;
          if (lineText.slice(start, start + issue.match.length) !== issue.match) return;

          var particle = readTrailingParticle(lineText, start + issue.match.length);
          var correctedParticle = correctParticleForReplacement(issue.replacement, particle);
          var end = start + issue.match.length + particle.length;

          lineText =
            lineText.slice(0, start) +
            issue.replacement +
            correctedParticle +
            lineText.slice(end);
        });

      lines[lineIndex] = lineText;
    });

    improvedText.textContent = lines.join('\n');
  }

  copyImprovedBtn.addEventListener('click', function() {
    var text = improvedText.textContent;
    if (!text) return;
    copyWithToast(text, '✅ 개선문이 복사되었습니다', '❌ 개선문 복사에 실패했습니다');
  });

  // ── US-L04: 검사 이력 ──
  var HISTORY_KEY = 'krds-lint-history';
  function readHistory() {
    try {
      var parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(function(entry) {
        if (!entry || typeof entry !== 'object') return null;
        var fullText = typeof entry.fullText === 'string'
          ? entry.fullText
          : typeof entry.text === 'string'
            ? entry.text
            : '';
        if (!fullText) return null;
        var previewText = typeof entry.text === 'string' && entry.text
          ? entry.text
          : fullText.slice(0, 80);
        var score = Number(entry.score);
        var issueCount = Number(entry.issueCount);
        return {
          date: typeof entry.date === 'string' && entry.date ? entry.date : '',
          score: isFinite(score) ? score : 0,
          text: previewText,
          fullText: fullText,
          issueCount: isFinite(issueCount) ? issueCount : 0
        };
      }).filter(Boolean).slice(0, 5);
    } catch(e) {
      return [];
    }
  }

  function saveHistory(text, score, issueCount) {
    try {
      var history = readHistory();
      history.unshift({ date: new Date().toLocaleDateString('ko-KR'), score: score, text: text.slice(0, 80), fullText: text, issueCount: issueCount });
      if (history.length > 5) history = history.slice(0, 5);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
  }

  function renderHistory() {
    var card = historyCard;
    var list = historyList;
    try {
      var history = readHistory();
      if (!history.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      list.innerHTML = history.map(function(h, i) {
        var color = h.score >= 80 ? 'var(--color-success-50)' : h.score >= 50 ? 'var(--color-warning-50)' : 'var(--color-danger-50)';
        return '<button data-idx="' + i + '" style="text-align:left; width:100%; background:var(--color-surface-sub); border:1px solid var(--color-border); border-radius:8px; padding:10px 14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">' +
          '<div>' +
          '<div style="font-size:12px; color:var(--color-text-sub);">' + escapeHtml(h.date) + ' · 이슈 ' + h.issueCount + '개</div>' +
          '<div style="font-size:13px; color:var(--color-text); margin-top:2px;">' + escapeHtml(h.text) + (h.text.length >= 80 ? '…' : '') + '</div>' +
          '</div>' +
          '<span style="font-weight:700; color:' + color + '; font-size:16px; margin-left:12px;">' + h.score + '</span>' +
          '</button>';
      }).join('');
    } catch(e) { card.style.display = 'none'; }
  }

  historyList.addEventListener('click', function(e) {
    var btn = closestIfPossible(e.target, '[data-idx]');
    if (!btn) return;
    try {
      var history = readHistory();
      var item = history[parseInt(btn.dataset.idx, 10)];
      if (item) {
        inputText.value = item.fullText || item.text;
        charCount.textContent = (item.fullText || item.text).length;
        invalidateAnalysis();
      }
    } catch(e) {}
  });

  clearHistoryBtn.addEventListener('click', function() {
    try { localStorage.removeItem(HISTORY_KEY); } catch(e) {}
    renderHistory();
  });

  // ── US-L05: CLI 유도 배너 ──
  var CLI_CMD = 'npm install -g github:thenisaid/krds-ux-writing';

  function renderCliBanner(score, textLen) {
    var banner = cliBanner;
    if (score < 60 || textLen > 300) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  cliBannerClose.addEventListener('click', function() {
    cliBanner.style.display = 'none';
  });

  copyCliBtn.addEventListener('click', function() {
    copyWithToast(CLI_CMD, '✅ 설치 명령어가 복사되었습니다', '❌ 설치 명령어 복사에 실패했습니다');
  });

  // ── URL 파라미터 자동 로드 ──
  (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      var t = params.get('t');
      if (t) {
        inputText.value = t;
        charCount.textContent = t.length;
        runLintAnalysis(t, { showToast: false });
      }
    } catch (e) {}
  })();

  updateShareBtn();
  renderHistory();

})();
