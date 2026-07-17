(function () {
  'use strict';

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }

  /* ── 다크모드 토글 ── */
  var themeBtn = document.getElementById('themeToggle');
  function syncThemeButton(theme) {
    if (!themeBtn) return;
    // 아이콘 전환은 CSS ([data-theme="dark"] .theme-icon-*) 가 담당
    themeBtn.setAttribute('aria-label', theme === 'dark' ? '라이트모드 전환' : '다크모드 전환');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      safeStorageSet('krds-theme', next);
      syncThemeButton(next);
    });
    syncThemeButton(document.documentElement.getAttribute('data-theme') || 'light');
  }

  /* ── 유틸 ── */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── 마크다운 파서 ── */
  function parseDerivedGuide(md) {
    var issues = [];
    function normalizePrinciple(raw) {
      var value = String(raw || '').trim();
      var matches = value.match(/[A-C]/g);
      if (!matches) return value;
      var seen = Object.create(null);
      return matches.filter(function (code) {
        if (seen[code]) return false;
        seen[code] = true;
        return true;
      }).join('/');
    }

    function cleanSnippet(value) {
      return String(value || '')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\n{3,}/g, '\n\n');
    }

    function parseFieldValue(block, label) {
      var inline = block.match(new RegExp('\\*\\*' + label + '\\*\\*:\\s*([^\\n]+)'));
      if (inline) return cleanSnippet(inline[1]);

      var blockMatch = block.match(new RegExp('\\*\\*' + label + '\\*\\*\\s*\\n([\\s\\S]*?)(?:\\n\\n(?=\\*\\*|\\|\\s*B \\(현재\\)\\s*\\|)|\\n---|$)'));
      return blockMatch ? cleanSnippet(blockMatch[1]) : '';
    }

    function parseCodeFenceAfterLabel(block, pattern) {
      var match = block.match(pattern);
      return match ? cleanSnippet(match[1]) : '';
    }

    function parseCurrentAndImproved(block) {
      var match = block.match(/🚫\s*현재(?:\s*\([^)]*\))?:\s*([\s\S]*?)✅\s*개선:\s*([\s\S]*?)(?:```|$)/);
      if (!match) return { original: '', recommendation: '' };
      return {
        original: cleanSnippet(match[1]),
        recommendation: cleanSnippet(match[2]),
      };
    }

    function parseTableCell(block, headingLabel) {
      var tableMatch = block.match(new RegExp('\\|\\s*' + headingLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\|\\s*([^|]+?)\\s*\\|'));
      return tableMatch ? cleanSnippet(tableMatch[1]) : '';
    }

    function parseComparisonRecommendation(block) {
      var rowsMatch = block.match(/\|\s*B \(현재\)\s*\|\s*A \(개선\)\s*\|[\s\S]*?\n\|[-| ]+\|\n((?:\|.*\|\n?)*)/);
      if (!rowsMatch) return '';
      var row = rowsMatch[1]
        .split('\n')
        .map(function (line) { return line.trim(); })
        .find(function (line) { return /^\|/.test(line); });
      if (!row) return '';
      var cells = row.split('|').map(function (cell) { return cleanSnippet(cell); }).filter(Boolean);
      return cells.length >= 2 ? cells[1] : '';
    }

    var cycleSections = md.split(/^(?=## Cycle \d+)/m);
    for (var s = 0; s < cycleSections.length; s++) {
      var section = cycleSections[s];
      var cycleM = section.match(/^## Cycle (\d+)/m);
      var cycle = cycleM ? parseInt(cycleM[1], 10) : 0;
      var blocks = section.split(/^(?=(?:###|####)\s+[EHF]\d+\s*[—:])/m);
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var head = block.match(/^(?:###|####)\s+([EHF]\d+)\s*[—:]\s*([^\n]+)/);
        if (!head) continue;

        var headingMeta = head[2].match(/^(.*?) (★+) \[([^\]]+)\]\s*$/);
        var id = head[1];
        var rawTitle = headingMeta ? headingMeta[1] : head[2];
        var severity = headingMeta ? headingMeta[2] : '';
        var principle = headingMeta ? normalizePrinciple(headingMeta[3]) : '';

        if (!principle) {
          principle = normalizePrinciple(parseTableCell(block, '**원칙**'));
        }
        if (!severity) {
          severity = parseTableCell(block, '**심각도**');
        }
        if (!principle) {
          var principleLine = block.match(/^>\s*원칙\s*:\s*(.*)$/m);
          principle = normalizePrinciple(principleLine ? principleLine[1] : '');
        }

        if (!principle && !severity) continue;

        var fenced = parseCurrentAndImproved(block);
        var original = parseFieldValue(block, '원문') ||
          parseCodeFenceAfterLabel(block, /\*\*현재(?: 텍스트| 마크업)?\*\*\s*```(?:html)?\s*([\s\S]*?)```/) ||
          fenced.original;
        var problem = parseFieldValue(block, '문제');
        var recommendation = parseFieldValue(block, '권장 개선안') ||
          parseFieldValue(block, '수정 제안') ||
          parseFieldValue(block, '개선안') ||
          fenced.recommendation ||
          parseComparisonRecommendation(block);

        var issTitle = rawTitle.replace(/^"|"$/g, '').trim();
        issues.push({
          id: id,
          title: issTitle,
          severity: severity,
          principle: principle,
          cycle: cycle,
          original: original,
          problem: problem,
          recommendation: recommendation,
          /* AI 설정자 관련 태그 — 기준:
             A: 오류 메시지 패턴  B: 완료 안내 패턴
             C: 시스템 제약 언어  D: KRDS 원칙 코드 인용 */
          aiConfigurator: isAiConfiguratorIssue(issTitle, original, problem, recommendation),
        });
      }
    }
    return issues;
  }

  var AI_CONFIG_PATTERNS = [
    /오류|에러|error|실패|실행\s*실패|인증|접근\s*거부|불일치|잘못된/i,
    /완료|성공|접수|제출|처리\s*완료|발급|등록\s*완료|확인\s*완료/i,
    /할\s*수\s*없|불가|제한|허용\s*되지|만료|초과|금지|차단/i,
    /원칙\s*[ABC]|무번역|정보핵심화|심리적\s*안전망/i,
  ];
  function isAiConfiguratorIssue(title, original, problem, recommendation) {
    var text = [title, original, problem, recommendation].join(' ');
    return AI_CONFIG_PATTERNS.some(function (re) { return re.test(text); });
  }

  /* ── 카드 렌더 ── */
  var SEV_CLASS = {'★':'sev-1','★★':'sev-2','★★★':'sev-3'};

  function renderGrid(issues, grid, countEl) {
    if (!grid) return;
    if (issues.length === 0) {
      grid.innerHTML = '<div class="arc-state">검색 결과가 없습니다.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    var html = issues.map(function(iss) {
      return '<div class="arc-card">' +
        '<div class="arc-card-head">' +
          '<span class="arc-card-id">' + escHtml(iss.id) + '</span>' +
          (iss.severity ? '<span class="arc-card-sev ' + (SEV_CLASS[iss.severity]||'sev-2') + '">' + escHtml(iss.severity) + '</span>' : '') +
          '<span class="arc-card-prin">[' + escHtml(iss.principle) + ']</span>' +
          (iss.cycle ? '<span class="arc-card-cycle">Cycle ' + iss.cycle + '</span>' : '') +
        '</div>' +
        '<p class="arc-card-title">' + escHtml(iss.title) + '</p>' +
        (iss.original ? '<div class="arc-card-row"><span class="arc-card-label">원문</span><span class="arc-card-val">' + escHtml(iss.original) + '</span></div>' : '') +
        (iss.problem ? '<div class="arc-card-row"><span class="arc-card-label">문제</span><span class="arc-card-val">' + escHtml(iss.problem) + '</span></div>' : '') +
        (iss.recommendation ? '<div class="arc-card-row arc-card-rec"><span class="arc-card-label">개선안</span><span class="arc-card-val">' + escHtml(iss.recommendation) + '</span></div>' : '') +
      '</div>';
    }).join('');
    grid.innerHTML = html;
    if (countEl) countEl.textContent = issues.length + '개 표시 / 전체 ' + issues.length + '개';
  }

  /* ── 기관별 상태 ── */
  var agencies = {
    jeongbu24: { md: null, all: [], loaded: false, loading: false, requestId: 0 },
    hometax:   { md: null, all: [], loaded: false, loading: false, requestId: 0 },
    efamily:   { md: null, all: [], loaded: false, loading: false, requestId: 0 }
  };

  var PRINCIPLE_NAMES = { 'A': '무번역', 'B': '정보핵심화', 'C': '심리적안전망' };
  var filters = { jeongbu24: 'all', hometax: 'all', efamily: 'all' };
  var searches = { jeongbu24: '', hometax: '', efamily: '' };
  var searchTimers = { jeongbu24: null, hometax: null, efamily: null };

  function applyFilters(agency) {
    var state = agencies[agency];
    if (!state || !state.loaded) return;
    var grid = document.getElementById('arc-grid-' + agency);
    var countEl = document.getElementById('arc-result-' + agency);
    var q = searches[agency].toLowerCase();
    var f = filters[agency];
    var result = state.all;
    if (f === 'ai') {
      result = result.filter(function(iss){ return iss.aiConfigurator; });
    } else if (f !== 'all') {
      result = result.filter(function(iss){ return iss.principle.includes(f); });
    }
    if (q) {
      result = result.filter(function(iss){
        return iss.id.toLowerCase().includes(q) ||
               iss.title.toLowerCase().includes(q) ||
               iss.original.toLowerCase().includes(q) ||
               iss.problem.toLowerCase().includes(q) ||
               iss.recommendation.toLowerCase().includes(q) ||
               iss.principle.split('/').some(function(p){ return (PRINCIPLE_NAMES[p.trim()] || '').includes(q); });
      });
    }
    renderGrid(result, grid, countEl);
    if (countEl) countEl.textContent = result.length + '개 표시 / 전체 ' + state.all.length + '개';
  }

  var basePath = window.KRDSBasePath;
  var BASE = basePath && typeof basePath.buildSitePath === 'function'
    ? basePath.buildSitePath('/derived/')
    : 'derived/';

  var MD_PATHS = {
    jeongbu24: BASE + 'jeongbu24-guide.md',
    hometax:   BASE + 'hometax-guide.md',
    efamily:   BASE + 'efamily-court-guide.md'
  };

  function finishAgencyLoad(state, requestId) {
    if (state.requestId === requestId) {
      state.loading = false;
    }
  }

  function loadAgency(agency) {
    var state = agencies[agency];
    if (!state || !MD_PATHS[agency]) return;
    if (state.loaded) { applyFilters(agency); return; }
    if (state.loading) return;
    state.loading = true;
    var requestId = ++state.requestId;
    fetch(MD_PATHS[agency])
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(md){
        if (state.requestId !== requestId) return;
        state.md = md;
        state.all = parseDerivedGuide(md);
        state.loaded = true;
        finishAgencyLoad(state, requestId);
        var badge = document.getElementById('arc-count-badge-' + agency);
        if (badge) badge.textContent = state.all.length;
        applyFilters(agency);
      })
      .catch(function(e){
        if (state.requestId !== requestId) return;
        finishAgencyLoad(state, requestId);
        var grid = document.getElementById('arc-grid-' + agency);
        if (grid) grid.innerHTML = '<div class="arc-state">로딩 실패: ' + escHtml(e.message) + '</div>';
      });
  }

  /* ── 탭 전환 ── */
  var tabs = document.querySelectorAll('.arc-tab');
  var panels = document.querySelectorAll('.arc-panel');
  if (!tabs.length || !panels.length) return;

  function getAgencyFromPanelId(panelId) {
    return String(panelId || '').replace(/^arc-panel-/, '');
  }

  function activateTab(tab) {
    var targetId = tab ? tab.getAttribute('aria-controls') : '';
    tabs.forEach(function(t){ t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
    panels.forEach(function(p){ p.classList.toggle('active', p.id === targetId); });
  }

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetId = tab.getAttribute('aria-controls');
      activateTab(tab);
      var agency = getAgencyFromPanelId(targetId);
      loadAgency(agency);
    });
    tab.addEventListener('keydown', function(e) {
      var arr = Array.from(tabs);
      var idx = arr.indexOf(tab);
      if (e.key === 'ArrowRight') { e.preventDefault(); arr[(idx+1)%arr.length].focus(); arr[(idx+1)%arr.length].click(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); arr[(idx-1+arr.length)%arr.length].focus(); arr[(idx-1+arr.length)%arr.length].click(); }
    });
  });

  /* ── 검색 & 필터 이벤트 연결 ── */
  ['jeongbu24','hometax','efamily'].forEach(function(agency) {
    var searchEl = document.getElementById('arc-search-' + agency);
    if (searchEl) searches[agency] = searchEl.value.trim();
    if (searchEl) {
      searchEl.addEventListener('input', function() {
        clearTimeout(searchTimers[agency]);
        searches[agency] = searchEl.value.trim();
        searchTimers[agency] = setTimeout(function(){ applyFilters(agency); }, 200);
      });
      searchEl.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { searchEl.value = ''; searches[agency] = ''; applyFilters(agency); }
      });
    }
    var filterBtns = document.querySelectorAll('[data-agency="' + agency + '"]');
    var activeFilterBtn = Array.from(filterBtns).find(function (btn) {
      return btn.classList.contains('active');
    });
    if (activeFilterBtn) filters[agency] = activeFilterBtn.dataset.principle || 'all';
    filterBtns.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn === activeFilterBtn ? 'true' : 'false');
    });
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        filters[agency] = btn.dataset.principle || 'all';
        filterBtns.forEach(function(b){
          var isActive = b === btn;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        applyFilters(agency);
      });
    });
  });

  /* ── 초기 로드 (첫 탭 자동) ── */
  var initialTab = Array.from(tabs).find(function (tab) {
    return tab.getAttribute('aria-selected') === 'true';
  }) || tabs[0];
  activateTab(initialTab);
  loadAgency(getAgencyFromPanelId(initialTab.getAttribute('aria-controls')));

})();
