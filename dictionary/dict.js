(function () {
  'use strict';

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const resultCount = document.getElementById('resultCount');
  const emptyState = document.getElementById('emptyState');
  const tableWrap = document.querySelector('.table-wrap table');
  const rows = Array.from(document.querySelectorAll('#dictBody tr'));
  const filterBtns = document.querySelectorAll('.filter-btn');

  let currentCat = 'all';
  let currentQuery = '';

  function normalize(s) {
    return s.toLowerCase().replace(/\s+/g, '');
  }

  function applyFilters() {
    let visible = 0;
    rows.forEach(function (row) {
      const cat = row.dataset.cat;
      const text = row.textContent;
      const catMatch = currentCat === 'all' || cat === currentCat;
      const queryMatch = currentQuery === '' || normalize(text).includes(normalize(currentQuery));
      const show = catMatch && queryMatch;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    resultCount.innerHTML = '<strong>' + visible + '</strong>개 용어';
    const isEmpty = visible === 0;
    emptyState.style.display = isEmpty ? 'block' : 'none';
    tableWrap.style.display = isEmpty ? 'none' : '';
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
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

  // Dark mode sync
  function syncTheme() {
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const stored = localStorage.getItem('krds-theme');
    document.documentElement.setAttribute('data-theme', stored || (sys ? 'dark' : 'light'));
  }
  syncTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
})();
