(function () {
  'use strict';

  var searchInput = document.getElementById('searchInput');
  var searchClear = document.getElementById('searchClear');
  var resultCount = document.getElementById('resultCount');
  var emptyState = document.getElementById('emptyState');
  var tableWrap = document.querySelector('.table-wrap table');
  var dictBody = document.getElementById('dictBody');
  var filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
  var totalStat = document.getElementById('fullGlossaryTotal');
  var categoryStat = document.getElementById('fullGlossaryCategoryCount');
  var generatedStat = document.getElementById('fullGlossaryGenerated');
  var rawData = (typeof window !== 'undefined' && window.KRDS_JARGON_DICT) ||
    (typeof globalThis !== 'undefined' && globalThis.KRDS_JARGON_DICT) ||
    null;

  if (!searchInput || !searchClear || !resultCount || !emptyState || !tableWrap || !dictBody || filterBtns.length === 0) {
    return;
  }

  var CAT_META = {
    admin: {
      label: '행정관습어',
      className: 'cat-admin',
    },
    double: {
      label: '이중부정',
      className: 'cat-double',
    },
    foreign: {
      label: '외래어·전문용어',
      className: 'cat-foreign',
    },
    ornate: {
      label: '과도한수식',
      className: 'cat-ornate',
    },
    formal: {
      label: '과도한경어',
      className: 'cat-formal',
    },
  };

  function mapCategory(cat) {
    switch (cat) {
      case '행정 관습어':
        return 'admin';
      case '이중 부정':
        return 'double';
      case '전문 용어':
      case '외래어':
        return 'foreign';
      case '과도한 수식':
        return 'ornate';
      case '과도한 경어':
        return 'formal';
      default:
        return 'admin';
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '');
  }

  function buildEntries() {
    if (!rawData || !Array.isArray(rawData.entries)) {
      return [];
    }

    return rawData.entries.map(function (entry) {
      var cat = mapCategory(entry.cat);
      var meta = CAT_META[cat] || CAT_META.admin;
      return {
        banned: entry.banned || '',
        alt: entry.alt || '',
        context: entry.context || '공통',
        cat: cat,
        catLabel: meta.label,
        catClass: meta.className,
      };
    });
  }

  var entries = buildEntries();
  var currentCat = 'all';
  var currentQuery = searchInput.value.trim();

  function countByCategory(list) {
    return list.reduce(function (acc, entry) {
      acc.all += 1;
      acc[entry.cat] = (acc[entry.cat] || 0) + 1;
      return acc;
    }, {
      all: 0,
      admin: 0,
      double: 0,
      foreign: 0,
      ornate: 0,
      formal: 0,
    });
  }

  function syncFilterBadges() {
    var counts = countByCategory(entries);

    filterBtns.forEach(function (btn) {
      var countNode = typeof btn.querySelector === 'function'
        ? btn.querySelector('.count')
        : null;
      if (!countNode) return;
      countNode.textContent = String(counts[btn.dataset.cat] || 0);
    });
  }

  function syncActiveFilter(activeBtn) {
    filterBtns.forEach(function (btn) {
      var isActive = btn === activeBtn;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function renderRows(list) {
    dictBody.innerHTML = list.map(function (entry) {
      return '' +
        '<tr data-cat="' + escapeHtml(entry.cat) + '">' +
          '<td class="td-bad">' + escapeHtml(entry.banned) + '</td>' +
          '<td class="td-good">' + escapeHtml(entry.alt) + '</td>' +
          '<td class="td-ctx"><span class="cat-tag ' + escapeHtml(entry.catClass) + '">' +
            escapeHtml(entry.catLabel) +
          '</span> ' + escapeHtml(entry.context) + '</td>' +
        '</tr>';
    }).join('');
  }

  function applyFilters() {
    var visibleEntries = entries.filter(function (entry) {
      var catMatch = currentCat === 'all' || entry.cat === currentCat;
      var haystack = normalizeText(entry.banned + ' ' + entry.alt + ' ' + entry.context + ' ' + entry.catLabel);
      var queryMatch = currentQuery === '' || haystack.indexOf(normalizeText(currentQuery)) !== -1;
      return catMatch && queryMatch;
    });

    renderRows(visibleEntries);
    resultCount.innerHTML = '<strong>' + visibleEntries.length + '</strong>개 용어';

    var isEmpty = visibleEntries.length === 0;
    emptyState.style.display = isEmpty ? 'block' : 'none';
    tableWrap.style.display = isEmpty ? 'none' : '';
  }

  function syncMetadata() {
    if (totalStat) totalStat.textContent = String(entries.length);
    if (categoryStat) categoryStat.textContent = String(Object.keys(CAT_META).length);
    if (generatedStat) generatedStat.textContent = rawData && rawData.generated ? String(rawData.generated) : '-';
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentCat = btn.dataset.cat || 'all';
      syncActiveFilter(btn);
      applyFilters();
    });
  });

  searchInput.addEventListener('input', function () {
    currentQuery = searchInput.value.trim();
    searchClear.style.display = currentQuery ? 'block' : 'none';
    applyFilters();
  });

  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    currentQuery = '';
    searchClear.style.display = 'none';
    searchInput.focus();
    applyFilters();
  });

  syncMetadata();
  syncFilterBadges();
  searchClear.style.display = currentQuery ? 'block' : 'none';
  syncActiveFilter(filterBtns[0]);
  applyFilters();
})();
