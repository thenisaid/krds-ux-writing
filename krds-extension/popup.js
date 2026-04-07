'use strict';

const GUIDE_URL = 'https://thenisaid.github.io/krds-ux-writing/';

const VALID_SECTIONS = new Set([
  'voice', 'buttons', 'forms', 'errors', 'onboarding', 'navigation',
  'labels', 'notifications', 'loading', 'empty-states', 'tables',
  'search', 'modals', 'tooltips', 'accessibility', 'principles',
  // also allow the ids present in searchData
  'tone', 'button', 'form', 'error', 'help', 'checklist',
]);

// ===== Search Data =====
const searchData = [
  {
    id: 'principles',
    tag: '언어 원칙',
    icon: '📐',
    preview: '사용자 중심·간결성·능동태·일관된 용어·긍정적 표현·명확성 6원칙',
  },
  {
    id: 'voice',
    tag: '브랜드 보이스',
    icon: '🎤',
    preview: '신뢰감 있고 전문적이되, 친근하고 배려하는 해결 중심 보이스',
  },
  {
    id: 'tone',
    tag: '톤앤매너',
    icon: '🎨',
    preview: '오류·경고·성공·온보딩 등 상황별 톤 가이드 및 경어 사용 원칙',
  },
  {
    id: 'button',
    tag: '버튼 & CTA',
    icon: '🔘',
    preview: '동사형 레이블 원칙 — "신청하기", "저장하기" 등 CTA 작성법',
    keywords: ['버튼', '신청하기', '결제하기', '저장하기', '제출하기', '삭제', 'CTA'],
  },
  {
    id: 'form',
    tag: '폼 & 입력',
    icon: '📝',
    preview: '레이블·플레이스홀더·필수/선택 표시, 유효성 검사 메시지 작성법',
    keywords: ['폼', '레이블', '플레이스홀더', '필수', '선택', '이메일', '비밀번호', '유효성'],
  },
  {
    id: 'error',
    tag: '에러 & 알림',
    icon: '⚠️',
    preview: '오류 메시지 4원칙 — 원인·영향·해결책·긍정적 마무리',
    keywords: ['오류', '에러', '알림', '네트워크', '시스템', '권한', '세션', '만료'],
  },
  {
    id: 'help',
    tag: '도움말 & 온보딩',
    icon: '💡',
    preview: '온보딩 문구·빈 상태 안내·인라인 텍스트·툴팁·코치마크 패턴',
    keywords: ['온보딩', '빈 상태', '툴팁', '코치마크', '도움말', '안내', '내비게이션'],
  },
  {
    id: 'loading',
    tag: '로딩 & 진행',
    icon: '⏳',
    preview: '"불러오는 중…" 등 진행 상태별 메시지와 성공/실패 피드백',
    keywords: ['로딩', '불러오는 중', '처리 중', '성공', '완료', '업로드', '대기', '진행'],
  },
  {
    id: 'accessibility',
    tag: '접근성 & 국제화',
    icon: '♿',
    preview: 'aria-label·alt 속성·스크린리더 대응, 날짜·화폐·전화번호 국제화',
    keywords: ['접근성', 'aria', 'alt', '스크린리더', '색상 대비', '국제화', 'i18n'],
  },
  {
    id: 'checklist',
    tag: '체크리스트',
    icon: '✅',
    preview: 'UX 라이팅 필수·권장 체크리스트 — 배포 전 점검 항목',
    keywords: ['체크리스트', '점검', '필수', '권장', '배포'],
  },
];

// ===== DOM References =====
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const resultsList = document.getElementById('resultsList');
const resultsView = document.getElementById('resultsView');
const tipsView = document.getElementById('tipsView');
const fullGuideBtn = document.getElementById('fullGuideBtn');
const openFullBtn = document.getElementById('openFullBtn');

// ===== Utilities =====
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(re, m => `<mark>${m}</mark>`);
}

function openGuide(sectionId) {
  if (sectionId && !VALID_SECTIONS.has(sectionId)) {
    sectionId = null;
  }
  const url = sectionId ? `${GUIDE_URL}#${sectionId}` : GUIDE_URL;
  chrome.tabs.create({ url });
}

// ===== Search =====
function doSearch(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    resultsView.style.display = 'none';
    tipsView.style.display = 'block';
    clearBtn.classList.remove('visible');
    return;
  }

  clearBtn.classList.add('visible');
  tipsView.style.display = 'none';
  resultsView.style.display = 'block';

  const hits = searchData.filter(d => {
    const keywords = d.keywords || [];
    return (
      d.tag.toLowerCase().includes(q) ||
      d.preview.toLowerCase().includes(q) ||
      keywords.some(k => k.toLowerCase().includes(q))
    );
  });

  resultsList.textContent = '';

  if (!hits.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'empty-icon';
    emptyIcon.textContent = '🔍';
    const emptyText = document.createElement('div');
    emptyText.className = 'empty-text';
    emptyText.textContent = `"${query}"에 대한 결과가 없습니다.`;
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(emptyText);
    resultsList.appendChild(emptyState);
    return;
  }

  hits.forEach(h => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    item.dataset.section = h.id;
    item.title = `${h.tag} 섹션 열기`;

    const iconEl = document.createElement('div');
    iconEl.className = 'result-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = h.icon;

    const body = document.createElement('div');
    body.className = 'result-body';

    const tagEl = document.createElement('div');
    tagEl.className = 'result-tag';
    tagEl.innerHTML = highlight(h.tag, q); // highlight() only produces <mark> tags around escaped text

    const previewEl = document.createElement('div');
    previewEl.className = 'result-preview';
    previewEl.innerHTML = highlight(h.preview, q); // same — safe escaped output with <mark>

    body.appendChild(tagEl);
    body.appendChild(previewEl);
    item.appendChild(iconEl);
    item.appendChild(body);
    resultsList.appendChild(item);
  });

  // Bind result click/keyboard
  resultsList.querySelectorAll('.result-item').forEach(item => {
    item.addEventListener('click', () => openGuide(item.dataset.section));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter') openGuide(item.dataset.section);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = item.nextElementSibling;
        if (next) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = item.previousElementSibling;
        if (prev) prev.focus(); else searchInput.focus();
      }
    });
  });
}

// ===== Event Listeners =====
searchInput.addEventListener('input', () => doSearch(searchInput.value));

searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const first = resultsList.querySelector('.result-item');
    if (first) first.focus();
  }
  if (e.key === 'Escape') {
    searchInput.value = '';
    doSearch('');
    searchInput.blur();
  }
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  doSearch('');
  searchInput.focus();
});

// Category chips
document.getElementById('categoryChips').addEventListener('click', e => {
  e.preventDefault();
  const chip = e.target.closest('.chip');
  if (!chip) return;

  // Toggle active
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');

  openGuide(chip.dataset.section);
});

// Footer button
fullGuideBtn.addEventListener('click', e => {
  e.preventDefault();
  openGuide(null);
});

openFullBtn.addEventListener('click', () => openGuide(null));

// ===== Init =====
searchInput.focus();
