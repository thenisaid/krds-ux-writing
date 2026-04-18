(function () {
  'use strict';

  // ── 테마 ──
  var savedTheme = (function() {
    try { return localStorage.getItem('krds-theme'); } catch(e) { return null; }
  })();
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  document.getElementById('themeToggle').addEventListener('click', function () {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    this.textContent = next === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('krds-theme', next); } catch(e) {}
  });

  // ── 옵션 칩 ──
  var opts = { checkAdminJargon: true, checkPatterns: true };
  document.querySelectorAll('.opt-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var key = this.dataset.opt;
      opts[key] = !opts[key];
      this.classList.toggle('active', opts[key]);
      this.setAttribute('aria-checked', opts[key] ? 'true' : 'false');
    });
    chip.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); }
    });
  });

  // ── 문자 카운터 ──
  var inputText = document.getElementById('inputText');
  inputText.addEventListener('input', function () {
    document.getElementById('charCount').textContent = this.value.length;
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

  document.getElementById('sampleBtn').addEventListener('click', function () {
    inputText.value = SAMPLE;
    document.getElementById('charCount').textContent = SAMPLE.length;
  });

  // ── 초기화 ──
  document.getElementById('clearBtn').addEventListener('click', function () {
    inputText.value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('scoreSection').innerHTML = emptyPlaceholder();
    document.getElementById('highlightCard').style.display = 'none';
    document.getElementById('issuesCard').style.display = 'none';
    lastResult = null;
  });

  function emptyPlaceholder() {
    return '<div class="empty-state"><div class="empty-icon" aria-hidden="true">📋</div>' +
      '<div class="empty-title">텍스트를 입력하고 검사해 주세요</div>' +
      '<div class="empty-desc">품질 점수와 이슈 목록이 여기에 표시됩니다</div></div>';
  }

  // ── 린팅 ──
  var lastResult = null;
  var currentFilter = 'all';

  document.getElementById('lintBtn').addEventListener('click', function () {
    var text = inputText.value.trim();
    if (!text) {
      inputText.focus();
      return;
    }
    lastResult = KRDSLint.lint(text, opts);
    renderScore(lastResult);
    renderHighlight(text, lastResult.issues);
    renderIssues(lastResult.issues);
  });

  // ── 점수 렌더 ──
  function renderScore(result) {
    var s = result.score;
    var circumference = 2 * Math.PI * 42;
    var offset = circumference * (1 - s / 100);
    var colorClass = s >= 80 ? 'score-good' : s >= 50 ? 'score-warning' : 'score-danger';
    var desc = s >= 80 ? '좋음' : s >= 50 ? '개선 필요' : '주의 필요';
    var descColor = s >= 80 ? 'var(--color-success-50)' : s >= 50 ? 'var(--color-warning-50)' : 'var(--color-danger-50)';

    document.getElementById('scoreSection').innerHTML =
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
    var card = document.getElementById('highlightCard');
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

    document.getElementById('highlightedText').innerHTML = marked.join('\n');
  }

  // ── 이슈 목록 렌더 ──
  function renderIssues(issues) {
    var card = document.getElementById('issuesCard');
    if (!issues.length) {
      card.style.display = 'block';
      document.getElementById('issuesList').innerHTML =
        '<div class="empty-state empty-success">' +
          '<div class="empty-icon" aria-hidden="true">✅</div>' +
          '<div class="empty-title">이슈가 없습니다!</div>' +
          '<div class="empty-desc">KRDS UX 라이팅 가이드라인을 준수하고 있습니다.</div>' +
        '</div>';
      document.getElementById('issuesTitle').textContent = '이슈 없음';
      return;
    }
    card.style.display = 'block';
    document.getElementById('issuesTitle').textContent = '이슈 목록 (' + issues.length + '건)';
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
    document.getElementById('issuesList').innerHTML = html || '<div class="empty-state"><div class="empty-desc">선택한 필터에 이슈가 없습니다.</div></div>';
  }

  // 필터 탭
  document.querySelectorAll('.filter-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      currentFilter = this.dataset.filter;
      document.querySelectorAll('.filter-tab').forEach(function (t) {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');
      if (lastResult) renderFilteredIssues(lastResult.issues, currentFilter);
    });
  });

  // ── 결과 복사 ──
  document.getElementById('copyBtn').addEventListener('click', function () {
    if (!lastResult) return;
    var text = KRDSLint.formatCLI(lastResult);
    var btn = this;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = '✅ 복사됨';
        setTimeout(function () { btn.innerHTML = '<span aria-hidden="true">📋</span> 결과 복사'; }, 2000);
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      btn.textContent = '✅ 복사됨';
      setTimeout(function () { btn.innerHTML = '<span aria-hidden="true">📋</span> 결과 복사'; }, 2000);
    }
  });

  // ── CSV 내보내기 ──
  document.getElementById('downloadBtn').addEventListener('click', function () {
    if (!lastResult || !lastResult.issues.length) return;
    var rows = [['줄', '열', '심각도', '카테고리', '메시지', '검출어', '제안']];
    lastResult.issues.forEach(function (i) {
      rows.push([i.line, i.col, i.severity, i.category, i.message, i.match, i.suggestion]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'krds-lint-result.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── 유틸 ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

})();
