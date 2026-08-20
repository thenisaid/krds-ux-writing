/**
 * MAIN world 브리지 — content.js(기본 isolated world)는 페이지 스크립트
 * (lint-ui.js)와 서로 다른 JS 래퍼 객체를 통해 같은 textarea DOM 노드를
 * 바라본다. isolated world에서 textarea 인스턴스에 건 Object.defineProperty
 * 오버라이드는 그 world의 래퍼에만 적용되고, 페이지 자체 코드(lint-ui.js)가
 * MAIN world에서 실행하는 대입은 가로채지 못한다
 * (2026-08-20 codex 리뷰 P2 — 샘플/초기화/기록 복원이 여전히 재검사를
 * 트리거하지 않던 문제. 이전 시도는 isolated world 내부에서만 검증됐고,
 * 실제 확장 실행 환경과 다른 세계에서 테스트해 통과로 오판했었음).
 *
 * 대신 MAIN world에서 실행되는 이 스크립트가 HTMLTextAreaElement.prototype.value
 * 세터를 감싸 CustomEvent를 쏘고, isolated world의 content.js는 해당 이벤트를
 * DOM 이벤트로 수신한다 — 이벤트는 world 경계와 무관하게 같은 DOM 트리를
 * 통해 전파되므로 안전하게 전달된다.
 */
(function () {
  'use strict';
  if (window.__krdsValueHookInstalled) return;
  window.__krdsValueHookInstalled = true;

  var proto = window.HTMLTextAreaElement.prototype;
  var desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc || !desc.set || !desc.get) return;

  Object.defineProperty(proto, 'value', {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set: function (v) {
      desc.set.call(this, v);
      this.dispatchEvent(new CustomEvent('krds:value-changed', { bubbles: true }));
    },
  });
})();
