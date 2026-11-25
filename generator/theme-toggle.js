/* generator 테마 토글 — 예전에는 index.html 맨 아래 인라인 <script> 였다.
   CSP 의 script-src 해시 목록에 없어서 브라우저가 실행하지 않았고, 그래서 버튼이 동작하지 않았다.
   외부 파일('self')로 옮겨 CSP 에 걸리지 않게 했다. 동작은 인라인 때와 같다. */
(function() {
  'use strict';
  var btn = document.getElementById('genThemeToggle');
  var moon = document.querySelector('.gen-icon-moon');
  var sun = document.querySelector('.gen-icon-sun');
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    if (moon) moon.style.display = t === 'dark' ? 'none' : 'block';
    if (sun) sun.style.display = t === 'dark' ? 'block' : 'none';
    if (btn) btn.setAttribute('aria-label', t === 'dark' ? '라이트모드 전환' : '다크모드 전환');
    try { localStorage.setItem('krds-theme', t); } catch(e) {}
  }
  var saved = null;
  try { saved = localStorage.getItem('krds-theme'); } catch(e) {}
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  if (btn) btn.addEventListener('click', function() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
})();
