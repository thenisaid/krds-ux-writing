(function () {
  'use strict';

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const resultCount = document.getElementById('resultCount');
  const emptyState = document.getElementById('emptyState');
  const tableWrap = document.querySelector('.table-wrap table');
  const rows = Array.from(document.querySelectorAll('#dictBody tr'));
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (!searchInput || !searchClear || !resultCount || !emptyState || !tableWrap || rows.length === 0 || filterBtns.length === 0) {
    return;
  }

  const activeFilterBtn = Array.from(filterBtns).find(function (btn) {
    return btn.classList.contains('active');
  });

  let currentCat = activeFilterBtn ? (activeFilterBtn.dataset.cat || 'all') : 'all';
  let currentQuery = searchInput.value.trim();

  function syncActiveFilter(activeBtn) {
    filterBtns.forEach(function (btn) {
      var isActive = btn === activeBtn;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

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
      syncActiveFilter(btn);
      currentCat = btn.dataset.cat || 'all';
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

  searchClear.style.display = currentQuery ? 'block' : 'none';
  syncActiveFilter(activeFilterBtn || filterBtns[0]);
  applyFilters();
})();
