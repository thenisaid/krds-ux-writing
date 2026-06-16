(function () {
  'use strict';

  if (!document || typeof document.addEventListener !== 'function') return;

  function closestIfPossible(node, selector) {
    return node && typeof node.closest === 'function' ? node.closest(selector) : null;
  }

  function fallbackCopy(text) {
    if (!document.body || typeof document.body.appendChild !== 'function' || typeof document.body.removeChild !== 'function') {
      return false;
    }

    var ta = document.createElement('textarea');
    if (!ta) return false;

    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    if (typeof ta.select === 'function') ta.select();

    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}

    document.body.removeChild(ta);
    return ok;
  }

  function copyWithFallback(text, onSuccess, onFailure) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
        if (fallbackCopy(text)) onSuccess();
        else if (typeof onFailure === 'function') onFailure();
      });
    } else if (fallbackCopy(text)) {
      onSuccess();
    } else if (typeof onFailure === 'function') {
      onFailure();
    }
  }

  function flash(btn, copied) {
    if (!btn) return;

    if (btn._promptCopyResetTimer) clearTimeout(btn._promptCopyResetTimer);
    btn.textContent = copied ? '복사됨!' : '복사 실패';
    btn.classList.toggle('copied', !!copied);
    btn._promptCopyResetTimer = setTimeout(function () {
      btn.textContent = '복사';
      btn.classList.remove('copied');
      btn._promptCopyResetTimer = null;
    }, 1800);
  }

  document.addEventListener('click', function (e) {
    var btn = closestIfPossible(e.target, '.pl-copy-btn');
    if (!btn || !btn.dataset) return;

    var pre = document.getElementById(btn.dataset.target);
    if (!pre) return;
    var actionId = (btn._promptCopyActionId || 0) + 1;
    btn._promptCopyActionId = actionId;

    copyWithFallback(
      pre.textContent,
      function () {
        if (btn._promptCopyActionId !== actionId) return;
        flash(btn, true);
      },
      function () {
        if (btn._promptCopyActionId !== actionId) return;
        flash(btn, false);
      }
    );
  });
})();
