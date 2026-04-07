
// ===== SEARCH DATA & FUNCTIONS =====
const searchData = [
  {id:'principles', tag:'언어 원칙', text:'6가지 핵심 원칙 사용자 중심 간결 능동태 일관된 용어 긍정적 표현 명확성', preview:'사용자 중심·간결성·능동태·일관된 용어·긍정적 표현·명확성 6원칙'},
  {id:'voice', tag:'브랜드 보이스', text:'신뢰감 있고 전문적 친근하고 배려 해결 중심 명확 배려 톤 보이스', preview:'신뢰감 있고 전문적이되, 친근하고 배려하는 해결 중심 보이스'},
  {id:'tone', tag:'톤앤매너', text:'상황별 톤 오류 상황 경고 주의 성공 완료 온보딩 빈 상태 경어 사용', preview:'오류·경고·성공·온보딩 등 상황별 톤 가이드 및 경어 사용 원칙'},
  {id:'button', tag:'버튼 & CTA', text:'동사형 레이블 신청하기 결제하기 저장하기 제출하기 삭제 CTA 버튼', preview:'동사형 레이블 원칙 — "신청하기", "저장하기" 등 CTA 작성법'},
  {id:'form', tag:'폼 & 입력', text:'레이블 플레이스홀더 필수 선택 이메일 비밀번호 개인정보 생년월일 성별 입력 제한 폼 유효성', preview:'레이블·플레이스홀더·필수/선택 표시, 유효성 검사 메시지 작성법'},
  {id:'error', tag:'에러 & 알림', text:'오류 메시지 4대 원칙 네트워크 오류 시스템 권한 접근 유효성 폼 유효성 세션 만료', preview:'오류 메시지 4원칙 — 원인·영향·해결책·긍정적 마무리'},
  {id:'help', tag:'도움말 & 온보딩', text:'온보딩 문구 빈 상태 안내 영역 인라인 텍스트 툴팁 코치마크 맥락적 내비게이션 메뉴 레이블 브레드크럼', preview:'온보딩 문구·빈 상태 안내·인라인 텍스트·툴팁·코치마크 패턴'},
  {id:'loading', tag:'로딩 & 진행', text:'로딩 불러오는 중 처리 중 성공 완료 업로드 대기 진행 내비게이션 상태', preview:'"불러오는 중…" 등 진행 상태별 메시지와 성공/실패 피드백'},
  {id:'error', tag:'성공 & 실패 메시지', text:'완료 저장 비밀번호 결제 실패 삭제 확인 오류', preview:'저장 완료·결제 실패·삭제 확인 등 결과 상태 메시지 패턴'},
  {id:'accessibility', tag:'접근성 & 국제화', text:'KWCAG WCAG aria-label alt 속성 스크린리더 색상 대비 초점 국제화 다국어 i18n 날짜 형식 화폐 전화번호', preview:'aria-label·alt 속성·스크린리더 대응, 날짜·화폐·전화번호 국제화'},
  {id:'checklist', tag:'체크리스트', text:'동사형 해결 방법 일관성 필수 권장 버튼 레이블 오류 aria 빈 상태', preview:'UX 라이팅 필수·권장 체크리스트 — 배포 전 점검 항목'},
];

function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll(
    'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  modalEl._trapHandler = function(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modalEl.addEventListener('keydown', modalEl._trapHandler);
}

function releaseFocus(modalEl) {
  if (modalEl._trapHandler) {
    modalEl.removeEventListener('keydown', modalEl._trapHandler);
    modalEl._trapHandler = null;
  }
}

function openSearch() {
  const modal = document.getElementById('searchModal');
  modal.classList.add('open');
  setTimeout(() => {
    document.getElementById('searchInput').focus();
    trapFocus(modal);
  }, 50);
}

function closeSearch() {
  const modal = document.getElementById('searchModal');
  modal.classList.remove('open');
  releaseFocus(modal);
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = '';
}

// ===== PERSONA TAB SWITCHING =====
function switchPersonaTab(name) {
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.persona-tab').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  // 모든 패널 숨기기
  document.querySelectorAll('.persona-panel').forEach(p => {
    p.classList.remove('active');
    p.hidden = true;
  });
  // 선택된 탭 활성화
  const activeBtn = document.getElementById('tab-btn-' + name);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
  }
  // 선택된 패널 표시
  const activePanel = document.getElementById('tab-' + name);
  if (activePanel) {
    activePanel.classList.add('active');
    activePanel.hidden = false;
  }
}

// ===== SCROLL NAVIGATION =====
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 86;
  window.scrollTo({ top, behavior: 'smooth' });
}

// ===== GNB SCROLL EFFECT =====
function initGnbScroll() {
  const gnb = document.getElementById('gnb');
  if (!gnb) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      gnb.classList.add('scrolled');
    } else {
      gnb.classList.remove('scrolled');
    }
  }, { passive: true });
}

// ===== SCROLL PROGRESS BAR =====
function initScrollProgress() {
  const fill = document.getElementById('scrollFill');
  if (!fill) return;
  window.addEventListener('scroll', () => {
    const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    fill.style.width = Math.min(pct, 100) + '%';
  }, { passive: true });
}

// ===== INTERSECTION OBSERVER (REVEAL + STAGGER) =====
function initReveal() {
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px 120px 0px' });

  const staggerObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const items = e.target.querySelectorAll('.stagger-item');
        items.forEach((item, i) => {
          setTimeout(() => item.classList.add('visible'), i * 80);
        });
        staggerObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
  const grid = document.querySelector('.composition-grid');
  if (grid) staggerObs.observe(grid);

  // 뷰포트 위(이미 지나친)와 뷰포트 안(현재 보이는) 요소를 즉시 visible 처리
  function revealInAndAbove() {
    const vh = window.innerHeight;
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      const top = el.getBoundingClientRect().top;
      // 뷰포트 위(bottom<0) 또는 뷰포트 안(top < vh)인 요소
      if (top < vh) el.classList.add('visible');
    });
    const g = document.querySelector('.composition-grid');
    if (g) {
      const top = g.getBoundingClientRect().top;
      if (top < vh) {
        g.querySelectorAll('.stagger-item:not(.visible)').forEach((item, i) => {
          setTimeout(() => item.classList.add('visible'), i * 80);
        });
      }
    }
  }

  // 앵커 이동 후 스크롤 완료 시점에 실행
  // hashchange: 앵커 클릭 → 스크롤 완료 후 100ms 대기
  window.addEventListener('hashchange', () => {
    setTimeout(revealInAndAbove, 100);
  });
  // 초기 앵커(URL에 이미 #hash 있는 경우): load 후 실행
  window.addEventListener('load', revealInAndAbove, { once: true });
}

// ===== CHECKLIST =====
function toggleCheck(item) {
  const isChecked = item.classList.toggle('checked');
  item.setAttribute('aria-checked', isChecked ? 'true' : 'false');
  const box = item.querySelector('.check-box');
  if (isChecked) {
    box.style.background = 'var(--success)';
    box.style.borderColor = 'var(--success)';
    box.style.color = 'white';
  } else {
    box.style.background = 'transparent';
    box.style.borderColor = 'var(--border)';
    box.style.color = 'transparent';
  }
  const all = document.querySelectorAll('.check-item');
  const checked = document.querySelectorAll('.check-item.checked');
  const complete = document.getElementById('checklistComplete');
  if (complete) {
    if (all.length === checked.length && checked.length > 0) {
      complete.classList.add('show');
    } else {
      complete.classList.remove('show');
    }
  }
  // Save state to localStorage
  all.forEach((el, idx) => {
    localStorage.setItem('krds-checklist-' + idx, el.classList.contains('checked') ? 'checked' : '');
  });
}

function resetChecklist() {
  const all = document.querySelectorAll('.check-item');
  all.forEach((item, idx) => {
    item.classList.remove('checked');
    item.setAttribute('aria-checked', 'false');
    const box = item.querySelector('.check-box');
    if (box) {
      box.style.background = 'transparent';
      box.style.borderColor = 'var(--border)';
      box.style.color = 'transparent';
    }
    localStorage.removeItem('krds-checklist-' + idx);
  });
  const complete = document.getElementById('checklistComplete');
  if (complete) complete.classList.remove('show');
}

function initChecklist() {
  const all = document.querySelectorAll('.check-item');
  let checkedCount = 0;
  all.forEach((item, idx) => {
    const saved = localStorage.getItem('krds-checklist-' + idx);
    if (saved === 'checked') {
      item.classList.add('checked');
      const box = item.querySelector('.check-box');
      if (box) {
        box.style.background = 'var(--success)';
        box.style.borderColor = 'var(--success)';
        box.style.color = 'white';
      }
      checkedCount++;
    }
  });
  const complete = document.getElementById('checklistComplete');
  if (complete && all.length > 0 && checkedCount === all.length) {
    complete.classList.add('show');
  }
}

// ===== COPY FUNCTION =====
// ===== ANCHOR LINK COPY =====
function copyAnchorLink(sectionId) {
  const url = window.location.href.split('#')[0] + '#' + sectionId;
  navigator.clipboard.writeText(url).then(() => {
    let toast = document.getElementById('anchor-toast');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.classList.remove('show'); }, 2500);
  });
}

function initAnchorButtons() {
  const toast = document.createElement('div');
  toast.id = 'anchor-toast';
  toast.textContent = '🔗 링크 복사됨';
  document.body.appendChild(toast);

  document.querySelectorAll('.guideline-section[id]').forEach(section => {
    const h2 = section.querySelector('h2.guideline-title');
    if (!h2) return;
    const btn = document.createElement('button');
    btn.className = 'anchor-btn';
    btn.setAttribute('aria-label', '섹션 링크 복사');
    btn.setAttribute('title', '섹션 링크 복사');
    btn.innerHTML = '🔗';
    btn.addEventListener('click', () => copyAnchorLink(section.id));
    h2.appendChild(btn);
  });
}

function cp(btn, text) {
  function onSuccess() {
    const prev = btn.textContent;
    btn.textContent = '✓ 복사됨';
    btn.classList.add('copied');
    btn.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.1)' },
      { transform: 'scale(0.97)' },
      { transform: 'scale(1)' }
    ], { duration: 300, easing: 'ease-out' });
    setTimeout(() => {
      btn.textContent = prev;
      btn.classList.remove('copied');
    }, 1500);
  }
  function onFail() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) { onSuccess(); }
    else { alert('복사에 실패했습니다. 텍스트를 직접 선택하여 복사해 주세요.'); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(onFail);
  } else {
    onFail();
  }
}

// ===== DARK MODE =====
function updateThemeIcon(theme) {
  const sun = document.querySelector('.icon-sun');
  const moon = document.querySelector('.icon-moon');
  if (!sun || !moon) return;
  if (theme === 'dark') {
    sun.style.display = 'none';
    moon.style.display = 'block';
  } else {
    sun.style.display = 'block';
    moon.style.display = 'none';
  }
  const btn = document.getElementById('themeToggle');
  if (btn) btn.setAttribute('aria-label', theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('krds-theme', next);
  updateThemeIcon(next);
}

(function initTheme() {
  const saved = localStorage.getItem('krds-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon(saved);
  });
})();

// ===== OS 단축키 감지 =====
(function initSearchShortcutHint() {
  const isMac = navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');
  const shortcutKey = isMac ? '⌘K' : 'Ctrl+K';
  document.addEventListener('DOMContentLoaded', function() {
    const hint = document.getElementById('searchShortcutHint');
    if (hint) hint.textContent = shortcutKey + ' 열기';
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.setAttribute('aria-label', '검색 열기 (' + shortcutKey + ')');
  });
})();

// ===== DOMCONTENTLOADED: SEARCH MODAL =====
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('searchModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === e.currentTarget) closeSearch(); });
  const input = document.getElementById('searchInput');
  if (!input) return;

  const escapeHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const highlight = (text, query) => {
    const escaped = escapeHtml(text);
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return escaped.replace(regex, m => `<mark>${m}</mark>`);
  };

  function renderResults(q) {
    const res = document.getElementById('searchResults');
    if (!q) { res.innerHTML = ''; return; }
    const hits = searchData.filter(d => d.text.toLowerCase().includes(q) || d.tag.toLowerCase().includes(q));
    if (!hits.length) {
      res.innerHTML = '<div style="padding:20px 24px;color:var(--text-muted);font-size:14px">검색 결과가 없습니다.</div>';
      return;
    }
    res.innerHTML = hits.map((h, i) => `
      <div class="search-result-item" role="option" tabindex="-1" data-section="${h.id}"
           data-section-id="${h.id}">
        <div class="search-result-tag">${highlight(h.tag, q)}</div>
        <div class="search-result-text">${highlight(h.preview || h.tag, q)}</div>
      </div>`).join('');
  }

  input.addEventListener('input', function() {
    renderResults(this.value.trim().toLowerCase());
  });

  // 검색 입력창에서 ArrowDown → 첫 번째 결과로 포커스
  input.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = document.querySelector('#searchResults .search-result-item');
      if (first) first.focus();
    }
  });
});

// ===== 검색 결과 키보드 내비게이션 =====
function handleResultKey(e, el) {
  const items = Array.from(document.querySelectorAll('#searchResults .search-result-item'));
  const idx = items.indexOf(el);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (idx < items.length - 1) items[idx + 1].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx > 0) items[idx - 1].focus();
    else document.getElementById('searchInput').focus();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    el.click();
  }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') { closeSearch(); closeMobileMenu(); }
});

// ===== MOBILE MENU =====
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('mobileMenuBtn');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    btn.setAttribute('aria-expanded', 'true');
    btn.querySelector('.icon-hamburger').style.display = 'none';
    btn.querySelector('.icon-close').style.display = 'block';
    document.body.style.overflow = 'hidden';
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('mobileMenuBtn');
  if (!menu || !menu.classList.contains('open')) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.querySelector('.icon-hamburger').style.display = 'block';
    btn.querySelector('.icon-close').style.display = 'none';
  }
  document.body.style.overflow = '';
}

// ===== DOMCONTENTLOADED: ANCHOR LINKS =====
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - 86;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
});

// ===== DOMCONTENTLOADED: INIT =====
document.addEventListener('DOMContentLoaded', function() {
  initGnbScroll();
  initScrollProgress();
  initReveal();
  initChecklist();
});

// ===== GNB DROPDOWN TOGGLE =====
function closeAllGnbDropdowns() {
  document.querySelectorAll('.gnb-item.has-dropdown').forEach(i => {
    i.classList.remove('open');
    const b = i.querySelector('.gnb-link');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

function openGnbDropdown(item, btn) {
  closeAllGnbDropdowns();
  item.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
}

function initGnbDropdowns() {
  document.querySelectorAll('.gnb-item.has-dropdown .gnb-link').forEach(btn => {
    const item = btn.closest('.gnb-item');
    const dropItems = () => Array.from(item.querySelectorAll('.gnb-dropdown-item'));

    // 클릭 토글
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = item.classList.contains('open');
      if (isOpen) { closeAllGnbDropdowns(); } else { openGnbDropdown(item, btn); }
    });

    // 키보드: ArrowDown/Up → 드롭다운 열고 포커스
    btn.addEventListener('keydown', (e) => {
      const isOpen = item.classList.contains('open');
      const items = dropItems();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen) openGnbDropdown(item, btn);
        if (items.length) items[0].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) openGnbDropdown(item, btn);
        if (items.length) items[items.length - 1].focus();
      } else if (e.key === 'Escape') {
        closeAllGnbDropdowns();
      }
    });

    // 드롭다운 아이템 키보드 내비게이션
    item.querySelectorAll('.gnb-dropdown-item').forEach(link => {
      link.addEventListener('keydown', (e) => {
        const items = dropItems();
        const idx = items.indexOf(link);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (idx < items.length - 1) items[idx + 1].focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (idx > 0) items[idx - 1].focus(); else btn.focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeAllGnbDropdowns();
          btn.focus();
        } else if (e.key === 'Tab') {
          // Tab/Shift+Tab으로 드롭다운 벗어날 때 닫기
          const leaving = (e.shiftKey && idx === 0) || (!e.shiftKey && idx === items.length - 1);
          if (leaving) closeAllGnbDropdowns();
        }
      });
    });
  });

  document.addEventListener('click', closeAllGnbDropdowns);
}

// ===== SCROLL SPY =====
function initScrollSpy() {
  // Map section id → dropdown item href
  const sectionToDropdownMap = {
    principles: '#principles',
    voice: '#voice',
    tone: '#tone',
    button: '#button',
    form: '#form',
    error: '#error',
    help: '#help',
    loading: '#loading',
    accessibility: '#accessibility',
    checklist: '#checklist'
  };

  function clearActiveStates() {
    document.querySelectorAll('.gnb-item.active').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.gnb-dropdown-item.active').forEach(a => a.classList.remove('active'));
  }

  function setActiveSection(sectionId) {
    clearActiveStates();
    const href = sectionToDropdownMap[sectionId];
    if (!href) return;

    // Find the dropdown item with matching href
    const dropdownItem = document.querySelector('.gnb-dropdown-item[href="' + href + '"]');
    if (dropdownItem) {
      dropdownItem.classList.add('active');
      // Also activate the parent gnb-item
      const parentItem = dropdownItem.closest('.gnb-item');
      if (parentItem) parentItem.classList.add('active');
    } else {
      // Non-dropdown link (e.g. accessibility)
      const directLink = document.querySelector('.gnb-link[href="' + href + '"]');
      if (directLink) {
        const parentItem = directLink.closest('.gnb-item');
        if (parentItem) parentItem.classList.add('active');
      }
    }
  }

  const sections = document.querySelectorAll('.guideline-section[id], .checklist-section[id]');
  if (!sections.length) return;

  // Track which section is most visible
  const visibleSections = new Map();

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        visibleSections.set(e.target.id, e.intersectionRatio);
      } else {
        visibleSections.delete(e.target.id);
      }
    });

    if (visibleSections.size === 0) return;

    // Pick the section with highest intersection ratio
    let topId = null;
    let topRatio = 0;
    visibleSections.forEach((ratio, id) => {
      if (ratio > topRatio) { topRatio = ratio; topId = id; }
    });
    if (topId) {
      setActiveSection(topId);
      history.replaceState(null, '', '#' + topId);
    }
  }, { threshold: [0, 0.1, 0.25, 0.5], rootMargin: '-60px 0px -30% 0px' });

  sections.forEach(s => observer.observe(s));
}

// ===== GNB DROPDOWNS INIT =====
// ===== STICKY TOC =====
function initStickyToc() {
  const toc = document.getElementById('stickyToc');
  if (!toc) return;
  const sections = ['principles','voice','tone','button','form','error','help','loading','accessibility','checklist'];
  const tocItems = {};
  sections.forEach(id => {
    tocItems[id] = toc.querySelector('[data-toc="' + id + '"]');
  });
  let activeId = null;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const id = entry.target.id;
      if (entry.isIntersecting) {
        if (activeId && tocItems[activeId]) tocItems[activeId].classList.remove('active');
        activeId = id;
        if (tocItems[id]) tocItems[id].classList.add('active');
      }
    });
  }, { rootMargin: '-10% 0px -70% 0px', threshold: 0 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
  // TOC 링크 클릭 시 즉시 활성화
  toc.querySelectorAll('.sticky-toc-item').forEach(a => {
    a.addEventListener('click', function() {
      const id = this.dataset.toc;
      if (activeId && tocItems[activeId]) tocItems[activeId].classList.remove('active');
      activeId = id;
      if (tocItems[id]) tocItems[id].classList.add('active');
    });
  });
  // 히어로/상단일 때 TOC 숨기기
  const hero = document.getElementById('hero');
  if (hero) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      toc.style.opacity = entry.isIntersecting ? '0' : '1';
      toc.style.pointerEvents = entry.isIntersecting ? 'none' : '';
    }, { threshold: 0.1 });
    heroObserver.observe(hero);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initGnbDropdowns();
  initAnchorButtons();
  initScrollSpy();
  initStickyToc();
  initInlineHandlers();
});

function initInlineHandlers() {
  // Theme toggle
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Search open
  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) searchBtn.addEventListener('click', openSearch);

  // Search close — button inside search overlay (no id, find by aria-label)
  const searchCloseBtn = document.querySelector('[aria-label="검색 닫기"]');
  if (searchCloseBtn) searchCloseBtn.addEventListener('click', closeSearch);

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);

  // Mobile menu items — event delegation
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.addEventListener('click', e => {
      const item = e.target.closest('.mobile-menu-item');
      if (item) closeMobileMenu();
    });
  }

  // Copy buttons — event delegation on document
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (btn) cp(btn, btn.dataset.copy);
  });

  // Checklist items — event delegation
  const checklistSection = document.getElementById('checklist');
  if (checklistSection) {
    checklistSection.addEventListener('click', e => {
      const item = e.target.closest('.check-item');
      if (item) toggleCheck(item);
    });
    checklistSection.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const item = e.target.closest('.check-item');
        if (item) { e.preventDefault(); toggleCheck(item); }
      }
    });
  }

  // Reset checklist
  const resetBtn = document.querySelector('[data-action="reset-checklist"]');
  if (resetBtn) resetBtn.addEventListener('click', resetChecklist);

  // Persona tabs
  ['writer', 'designer', 'developer'].forEach(name => {
    const btn = document.getElementById('tab-btn-' + name);
    if (btn) btn.addEventListener('click', () => switchPersonaTab(name));
  });

  // Search results — delegated (for dynamic content)
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.addEventListener('click', e => {
      const item = e.target.closest('[data-section-id]');
      if (item) {
        scrollToSection(item.dataset.sectionId);
        closeSearch();
      }
    });
    searchResults.addEventListener('keydown', e => {
      const item = e.target.closest('[data-section-id]');
      if (item) handleResultKey(e, item);
    });
  }
}
