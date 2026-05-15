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
    document.getElementById('improvedCard').style.display = 'none';
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
  var toastEl = document.getElementById('toast');

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
    renderImproved(text, lastResult.issues);
    saveHistory(text, lastResult.score, lastResult.issues.length);
    renderHistory();
    renderCliBanner(lastResult.score, text.length);
    updateShareBtn();
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
    var origHtml = '<span aria-hidden="true">📋</span> 결과 복사';
    function legacyCopy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      btn.textContent = ok ? '✅ 복사됨' : '❌ 복사 실패';
      setTimeout(function () { btn.innerHTML = origHtml; }, 2000);
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = '✅ 복사됨';
        setTimeout(function () { btn.innerHTML = origHtml; }, 2000);
      }).catch(legacyCopy);
    } else {
      legacyCopy();
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

  // ── CSV 내보내기 이후 추가 기능들 ──

  // ── 토스트 ──
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(function () { toastEl.classList.remove('show'); }, 2000);
  }

  // ── 결과 링크 복사 ──
  function updateShareBtn() {
    var text = inputText.value.trim();
    var btn = document.getElementById('shareLinkBtn');
    if (!btn || !lastResult) return;
    if (text.length > 500) {
      btn.disabled = true;
      btn.title = '텍스트가 500자를 초과하면 URL 공유를 사용할 수 없습니다';
    } else {
      btn.disabled = false;
      btn.title = '';
    }
  }

  document.getElementById('shareLinkBtn').addEventListener('click', function () {
    var text = inputText.value.trim();
    if (!text || text.length > 500) {
      showToast('⚠️ 500자 이하 텍스트만 링크로 공유할 수 있습니다');
      return;
    }
    var url = window.location.href.split('?')[0] + '?t=' + encodeURIComponent(text);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('✅ 링크가 클립보드에 복사되었습니다');
      }).catch(function () {
        copyFallback(url);
      });
    } else {
      copyFallback(url);
    }
  });

  function copyFallback(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
    showToast('✅ 링크가 클립보드에 복사되었습니다');
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
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── US-L02: Before/After 개선문 ──
  function renderImproved(text, issues) {
    var card = document.getElementById('improvedCard');
    // Only replace admin-jargon issues (PRD: 감지된 행정어만 교체)
    var jargonIssues = issues.filter(function(i) { return i.type === 'admin-jargon' && i.match && i.suggestion; });
    if (!jargonIssues.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    // Build replacement map (match → first alt), sort by length descending to avoid partial replacements
    var replacements = {};
    jargonIssues.forEach(function(i) {
      if (!replacements[i.match]) {
        // suggestion format: '→ firstAlt, secondAlt' — strip arrow prefix, take first
        var altStr = i.suggestion.replace(/^→\s*/, '');
        replacements[i.match] = altStr.split(',')[0].trim();
      }
    });
    var terms = Object.keys(replacements).sort(function(a, b) { return b.length - a.length; });
    var result = text;
    terms.forEach(function(term) {
      var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var repl = replacements[term];
      var lastCode = repl.charCodeAt(repl.length - 1);
      var isKorean = lastCode >= 0xAC00 && lastCode <= 0xD7A3;
      var hasBatchim = isKorean && (lastCode - 0xAC00) % 28 !== 0;
      result = result.replace(new RegExp(escaped + '(으로|가|를|는|로|와|이|을|은|과)?', 'g'), function(match, particle) {
        if (!particle) return repl;
        var corrected = particle;
        if (hasBatchim) {
          corrected = ({'\uAC00':'\uC774','\uB97C':'\uC744','\uB294':'\uC740','\uB85C':'\uC73C\uB85C','\uC640':'\uACFC'})[particle] || particle;
        } else if (isKorean) {
          corrected = ({'\uC774':'\uAC00','\uC744':'\uB97C','\uC740':'\uB294','\uC73C\uB85C':'\uB85C','\uACFC':'\uC640'})[particle] || particle;
        }
        return repl + corrected;
      });
    });
    document.getElementById('improvedText').textContent = result;
  }

  document.getElementById('copyImprovedBtn').addEventListener('click', function() {
    var text = document.getElementById('improvedText').textContent;
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { showToast('✅ 개선문이 복사되었습니다'); });
    } else { copyFallback(text); showToast('✅ 개선문이 복사되었습니다'); }
  });

  // ── US-L04: 검사 이력 ──
  var HISTORY_KEY = 'krds-lint-history';

  function saveHistory(text, score, issueCount) {
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      history.unshift({ date: new Date().toLocaleDateString('ko-KR'), score: score, text: text.slice(0, 80), fullText: text, issueCount: issueCount });
      if (history.length > 5) history = history.slice(0, 5);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
  }

  function renderHistory() {
    var card = document.getElementById('historyCard');
    var list = document.getElementById('historyList');
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (!history.length) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      list.innerHTML = history.map(function(h, i) {
        var color = h.score >= 80 ? 'var(--color-success-50)' : h.score >= 50 ? 'var(--color-warning-50)' : 'var(--color-danger-50)';
        return '<button data-idx="' + i + '" style="text-align:left; width:100%; background:var(--color-surface-sub); border:1px solid var(--color-border); border-radius:8px; padding:10px 14px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">' +
          '<div>' +
          '<div style="font-size:12px; color:var(--color-text-sub);">' + h.date + ' · 이슈 ' + h.issueCount + '개</div>' +
          '<div style="font-size:13px; color:var(--color-text); margin-top:2px;">' + escapeHtml(h.text) + (h.text.length >= 80 ? '…' : '') + '</div>' +
          '</div>' +
          '<span style="font-weight:700; color:' + color + '; font-size:16px; margin-left:12px;">' + h.score + '</span>' +
          '</button>';
      }).join('');
    } catch(e) { card.style.display = 'none'; }
  }

  document.getElementById('historyList').addEventListener('click', function(e) {
    var btn = e.target.closest('[data-idx]');
    if (!btn) return;
    try {
      var history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      var item = history[parseInt(btn.dataset.idx)];
      if (item) { inputText.value = item.fullText || item.text; document.getElementById('charCount').textContent = (item.fullText || item.text).length; }
    } catch(e) {}
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', function() {
    try { localStorage.removeItem(HISTORY_KEY); } catch(e) {}
    renderHistory();
  });

  // ── US-L05: CLI 유도 배너 ──
  var CLI_CMD = 'npm install -g github:thenisaid/krds-ux-writing';

  function renderCliBanner(score, textLen) {
    var banner = document.getElementById('cliBanner');
    if (score < 60 || textLen > 300) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  document.getElementById('cliBannerClose').addEventListener('click', function() {
    document.getElementById('cliBanner').style.display = 'none';
  });

  document.getElementById('copyCliBtn').addEventListener('click', function() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(CLI_CMD).then(function() { showToast('✅ 설치 명령어가 복사되었습니다'); });
    } else { copyFallback(CLI_CMD); showToast('✅ 설치 명령어가 복사되었습니다'); }
  });

  // ── URL 파라미터 자동 로드 ──
  (function () {
    try {
      var params = new URLSearchParams(window.location.search);
      var t = params.get('t');
      if (t) {
        inputText.value = t;
        document.getElementById('charCount').textContent = t.length;
        lastResult = KRDSLint.lint(t, opts);
        renderScore(lastResult);
        renderHighlight(t, lastResult.issues);
        renderIssues(lastResult.issues);
        renderImproved(t, lastResult.issues);
        renderCliBanner(lastResult.score, t.length);
        updateShareBtn();
      }
    } catch (e) {}
  })();

})();
