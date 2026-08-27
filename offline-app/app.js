/**
 * KRDS UX 라이팅 검사기 (오프라인) — UI 로직
 * 네트워크 호출, 로컬 저장소, URL 공유 기능을 포함하지 않는다.
 */
(function () {
  'use strict';

  var textarea = document.getElementById('input-text');
  var lintBtn = document.getElementById('lint-btn');
  var clearBtn = document.getElementById('clear-btn');
  var resultPanel = document.getElementById('result-panel');

  var SEVERITY_LABEL = { error: '오류', warning: '경고', info: '안내' };
  var EMPTY_MESSAGE = '검사 버튼을 누르면 결과가 여기에 표시됩니다.';

  function clearChildren(el) {
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function renderEmpty(message) {
    clearChildren(resultPanel);
    var p = document.createElement('p');
    p.className = 'empty-state';
    p.textContent = message;
    resultPanel.appendChild(p);
  }

  function renderResult(result) {
    clearChildren(resultPanel);

    var summary = document.createElement('div');
    summary.className = 'summary';

    var score = document.createElement('div');
    score.className = 'score';
    score.textContent = '품질 점수 ' + result.score + '/100';
    summary.appendChild(score);

    var counts = document.createElement('div');
    counts.className = 'counts';
    counts.textContent =
      '총 ' + result.summary.total + '건 (오류 ' + result.summary.errors +
      ' · 경고 ' + result.summary.warnings + ' · 안내 ' + result.summary.infos + ')';
    summary.appendChild(counts);

    resultPanel.appendChild(summary);

    if (result.issues.length === 0) {
      var ok = document.createElement('p');
      ok.className = 'empty-state';
      ok.textContent = '발견된 이슈가 없습니다.';
      resultPanel.appendChild(ok);
      return;
    }

    var list = document.createElement('ul');
    list.className = 'issue-list';

    result.issues.forEach(function (issue) {
      var item = document.createElement('li');
      item.className = 'issue issue-' + issue.severity;

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = SEVERITY_LABEL[issue.severity] || issue.severity;
      item.appendChild(badge);

      var loc = document.createElement('span');
      loc.className = 'loc';
      loc.textContent = issue.line + '행 ' + issue.col + '열';
      item.appendChild(loc);

      var cat = document.createElement('span');
      cat.className = 'category';
      cat.textContent = issue.category;
      item.appendChild(cat);

      var msg = document.createElement('p');
      msg.className = 'message';
      msg.textContent = issue.message;
      item.appendChild(msg);

      if (issue.suggestion) {
        var sug = document.createElement('p');
        sug.className = 'suggestion';
        sug.textContent = issue.suggestion;
        item.appendChild(sug);
      }

      list.appendChild(item);
    });

    resultPanel.appendChild(list);
  }

  function runLint() {
    if (typeof window.KRDSLint === 'undefined') {
      renderEmpty('검사 엔진을 불러오지 못했습니다.');
      return;
    }

    var text = textarea.value;
    if (!text.trim()) {
      renderEmpty('검사할 문구를 입력하세요.');
      return;
    }

    var result = window.KRDSLint.lint(text);
    renderResult(result);
  }

  function clearAll() {
    textarea.value = '';
    renderEmpty(EMPTY_MESSAGE);
    textarea.focus();
  }

  lintBtn.addEventListener('click', runLint);
  clearBtn.addEventListener('click', clearAll);
})();
