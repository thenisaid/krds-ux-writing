/*
 * shared/drawer.js — 모바일 햄버거 드로어 열기·닫기 전용
 *
 * shared/nav.js 를 로드하지 않는 페이지(archive.html, before-after.html …)가 쓴다.
 * nav.js 의 사이드바 동작(열기·닫기·포커스 가두기·Esc·backdrop·resize)만 같게 구현하고,
 * 테마·검색 단축키·GNB 키보드 내비게이션·스크롤 스파이는 넣지 않는다(각 페이지가 자체 처리).
 *
 * nav.js 와 한 페이지에서 함께 로드하면 이중 바인딩되므로 로드하지 않는다(tests/drawer-js.test.js 가 고정).
 * 이 파일을 두 번 로드하는 실수는 <html data-krds-drawer> 가드로 막는다.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (root.hasAttribute('data-krds-drawer')) return;

  var drawer = document.querySelector('.site-drawer');
  if (!drawer) return;
  root.setAttribute('data-krds-drawer', '');

  var backdrop = document.querySelector('.sidebar-backdrop');
  var hamburger = document.getElementById('gnbHamburger');
  var trapHandler = null;

  function syncHamburgerState(isOpen) {
    if (!hamburger) return;
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    hamburger.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
  }

  function trapFocus(el) {
    var focusable = Array.from(el.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(function (n) { return !n.hasAttribute('hidden') && n.offsetParent !== null; });
    if (!focusable.length) return;
    focusable[0].focus();
    trapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', trapHandler);
  }

  function releaseFocus(el, restoreFocus) {
    if (trapHandler) { el.removeEventListener('keydown', trapHandler); trapHandler = null; }
    if (restoreFocus !== false && hamburger) hamburger.focus();
  }

  function openDrawer() {
    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    syncHamburgerState(true);
    document.body.style.overflow = 'hidden';
    trapFocus(drawer);
  }

  function closeDrawer(restoreFocus) {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    syncHamburgerState(false);
    document.body.style.overflow = '';
    releaseFocus(drawer, restoreFocus);
  }

  syncHamburgerState(false);
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      if (drawer.classList.contains('open')) closeDrawer(); else openDrawer();
    });
  }
  if (backdrop) {
    backdrop.addEventListener('click', function () { closeDrawer(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) closeDrawer(false);
  });
})();
