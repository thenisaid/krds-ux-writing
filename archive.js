(function () {
  'use strict';

  /* ── 다크모드 토글 ── */
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('krds-theme', next);
      themeBtn.textContent = next === 'dark' ? '☾' : '☀';
    });
    themeBtn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☾' : '☀';
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
    var blocks = md.split(/^(?=### [EHF]\d+)/m);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var hm = block.match(/^### ([EHF]\d+) — (.*?) (★+) \[([A-C/]+)\]/);
      if (!hm) continue;
      var id = hm[1], rawTitle = hm[2], severity = hm[3], principle = hm[4];
      var cycleM = md.match(new RegExp('## Cycle (\\d+)[\\s\\S]*?' + id + '\\b'));
      var cycle = cycleM ? parseInt(cycleM[1]) : 0;
      function getField(label) {
        var m = block.match(new RegExp('\\*\\*' + label + '\\*\\*:\\s*([^\n]+)'));
        return m ? m[1].trim() : '';
      }
      issues.push({
        id: id,
        title: rawTitle.replace(/^"|"$/g, '').trim(),
        severity: severity,
        principle: principle,
        cycle: cycle,
        original: getField('원문'),
        problem: getField('문제'),
        recommendation: getField('권장 개선안') || getField('수정 제안') || getField('개선안')
      });
    }
    return issues;
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
          '<span class="arc-card-id">' + iss.id + '</span>' +
          '<span class="arc-card-sev ' + (SEV_CLASS[iss.severity]||'sev-2') + '">' + iss.severity + '</span>' +
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
    jeongbu24: { md: null, all: [], loaded: false },
    hometax:   { md: null, all: [], loaded: false },
    efamily:   { md: null, all: [], loaded: false }
  };

  var PRINCIPLE_NAMES = { 'A': '무번역', 'B': '정보핵심화', 'C': '심리적안전망' };
  var filters = { jeongbu24: 'all', hometax: 'all', efamily: 'all' };
  var searches = { jeongbu24: '', hometax: '', efamily: '' };
  var searchTimers = { jeongbu24: null, hometax: null, efamily: null };

  function applyFilters(agency) {
    var state = agencies[agency];
    var grid = document.getElementById('arc-grid-' + agency);
    var countEl = document.getElementById('arc-result-' + agency);
    var q = searches[agency].toLowerCase();
    var f = filters[agency];
    var result = state.all;
    if (f !== 'all') {
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

  var BASE = document.location.href.includes('github.io')
    ? 'https://thenisaid.github.io/krds-ux-writing/derived/'
    : 'derived/';

  var MD_PATHS = {
    jeongbu24: BASE + 'jeongbu24-guide.md',
    hometax:   BASE + 'hometax-guide.md',
    efamily:   BASE + 'efamily-court-guide.md'
  };

  function loadAgency(agency) {
    var state = agencies[agency];
    if (state.loaded) { applyFilters(agency); return; }
    fetch(MD_PATHS[agency])
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(md){
        state.all = parseDerivedGuide(md);
        state.loaded = true;
        var badge = document.getElementById('arc-count-badge-' + agency);
        if (badge) badge.textContent = state.all.length;
        applyFilters(agency);
      })
      .catch(function(e){
        var grid = document.getElementById('arc-grid-' + agency);
        if (grid) grid.innerHTML = '<div class="arc-state">로딩 실패: ' + escHtml(e.message) + '</div>';
      });
  }

  /* ── 탭 전환 ── */
  var tabs = document.querySelectorAll('.arc-tab');
  var panels = document.querySelectorAll('.arc-panel');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetId = tab.getAttribute('aria-controls');
      tabs.forEach(function(t){ t.setAttribute('aria-selected', 'false'); });
      panels.forEach(function(p){ p.classList.remove('active'); });
      tab.setAttribute('aria-selected', 'true');
      var panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
      var agency = targetId.replace('arc-panel-', '');
      loadAgency(agency);
    });
    tab.addEventListener('keydown', function(e) {
      var arr = Array.from(tabs);
      var idx = arr.indexOf(tab);
      if (e.key === 'ArrowRight') { arr[(idx+1)%arr.length].focus(); arr[(idx+1)%arr.length].click(); }
      if (e.key === 'ArrowLeft')  { arr[(idx-1+arr.length)%arr.length].focus(); arr[(idx-1+arr.length)%arr.length].click(); }
    });
  });

  /* ── 검색 & 필터 이벤트 연결 ── */
  ['jeongbu24','hometax','efamily'].forEach(function(agency) {
    var searchEl = document.getElementById('arc-search-' + agency);
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
    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        filters[agency] = btn.dataset.principle || 'all';
        filterBtns.forEach(function(b){ b.classList.toggle('active', b === btn); });
        applyFilters(agency);
      });
    });
  });

  /* ── 초기 로드 (첫 탭 자동) ── */
  loadAgency('jeongbu24');

})();
