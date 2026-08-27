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
  var rulepackInput = document.getElementById('rulepack-input');
  var rulepackFile = document.getElementById('rulepack-file');
  var rulepackApplyBtn = document.getElementById('rulepack-apply-btn');
  var rulepackStatus = document.getElementById('rulepack-status');

  var SEVERITY_LABEL = { error: '오류', warning: '경고', info: '안내' };
  var EMPTY_MESSAGE = '검사 버튼을 누르면 결과가 여기에 표시됩니다.';

  // 기관 Rule Pack에서 승인된 예외 용어. term(문자열) -> entry.
  // 임의의 term 값(예: "__proto__")이 들어와도 프로토타입 오염이 발생하지
  // 않도록 일반 객체 리터럴 대신 Map을 사용한다.
  var ruleExceptions = new Map();
  var lastLintResult = null;

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

    // 기관 승인 예외로 처리된 이슈는 실제 위반이 아니므로 집계(총 건수 ·
    // 오류/경고/안내 개수)에서 제외해 표시한다. 품질 점수는 krds-lint.js
    // 내부의 마스킹·글자수 기반 계산식을 그대로 재사용해야 정확한데
    // 그 계산식은 이 UI 레벨에 노출되어 있지 않으므로, 여기서는 원본
    // 점수를 "예외 적용 전" 값임을 명시해 표시한다(카운트 재계산 fix, codex 리뷰 반영).
    var visibleIssues = result.issues.filter(function (issue) {
      return !ruleExceptions.has(issue.match);
    });
    var exemptCount = result.issues.length - visibleIssues.length;
    var effectiveSummary = {
      total: visibleIssues.length,
      errors: visibleIssues.filter(function (i) { return i.severity === 'error'; }).length,
      warnings: visibleIssues.filter(function (i) { return i.severity === 'warning'; }).length,
      infos: visibleIssues.filter(function (i) { return i.severity === 'info'; }).length,
    };

    var summary = document.createElement('div');
    summary.className = 'summary';

    var score = document.createElement('div');
    score.className = 'score';
    score.textContent = '품질 점수 ' + result.score + '/100' + (exemptCount > 0 ? ' (예외 적용 전 원본 값)' : '');
    summary.appendChild(score);

    var counts = document.createElement('div');
    counts.className = 'counts';
    counts.textContent =
      '총 ' + effectiveSummary.total + '건 (오류 ' + effectiveSummary.errors +
      ' · 경고 ' + effectiveSummary.warnings + ' · 안내 ' + effectiveSummary.infos + ')' +
      (exemptCount > 0 ? ' · 기관 승인 예외 ' + exemptCount + '건 제외' : '');
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
      var exemption = ruleExceptions.get(issue.match);
      var item = document.createElement('li');
      item.className = 'issue issue-' + issue.severity + (exemption ? ' issue-exempt' : '');

      var badge = document.createElement('span');
      if (exemption) {
        badge.className = 'badge badge-exempt';
        badge.textContent = '기관 승인 예외';
      } else {
        badge.className = 'badge';
        badge.textContent = SEVERITY_LABEL[issue.severity] || issue.severity;
      }
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

      if (exemption) {
        var note = document.createElement('p');
        note.className = 'suggestion exempt-note';
        note.textContent =
          '승인 근거: ' + exemption.rationale + ' (' + exemption.agencyName + ' · ' +
          exemption.approver + ', 재검토일 ' + exemption.reviewDate + ')';
        item.appendChild(note);
      } else if (issue.suggestion) {
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
    lastLintResult = result;
    renderResult(result);
  }

  function clearAll() {
    textarea.value = '';
    lastLintResult = null;
    renderEmpty(EMPTY_MESSAGE);
    textarea.focus();
  }

  function buildExceptionMap(entries) {
    var map = new Map();
    entries.forEach(function (entry) {
      map.set(entry.term, entry);
    });
    return map;
  }

  function renderRulePackStatus(result) {
    clearChildren(rulepackStatus);

    if (result.valid) {
      var p = document.createElement('p');
      p.className = 'success';
      p.textContent =
        '적용됨: ' + result.data.agencyName + ' Rule Pack (버전 ' + result.data.version +
        ', 승인 예외 용어 ' + result.data.entries.length + '건)';
      rulepackStatus.appendChild(p);
      return;
    }

    var errorHeading = document.createElement('p');
    errorHeading.className = 'error';
    errorHeading.textContent = 'Rule Pack 적용 실패:';
    rulepackStatus.appendChild(errorHeading);

    var ul = document.createElement('ul');
    result.errors.forEach(function (message) {
      var li = document.createElement('li');
      li.textContent = message;
      ul.appendChild(li);
    });
    rulepackStatus.appendChild(ul);
  }

  function applyRulePack() {
    if (typeof window.KRDSRulePackValidator === 'undefined') {
      renderRulePackStatus({ valid: false, errors: ['Rule Pack 검증 모듈을 불러오지 못했습니다.'] });
      return;
    }

    var result = window.KRDSRulePackValidator.validateRulePack(rulepackInput.value);
    if (!result.valid) {
      // 검증 실패 시 이전에 적용된 유효한 Rule Pack은 그대로 유지한다.
      renderRulePackStatus(result);
      return;
    }

    ruleExceptions = buildExceptionMap(result.data.entries);
    renderRulePackStatus(result);

    if (lastLintResult) {
      renderResult(lastLintResult);
    }
  }

  function loadRulePackFile() {
    var file = rulepackFile.files && rulepackFile.files[0];
    if (!file) return;

    // 큰 파일을 메모리에 올리기 전에 크기부터 거부한다 (FileReader 호출 전 검사).
    var maxBytes =
      (window.KRDSRulePackSchema && window.KRDSRulePackSchema.MAX_FILE_SIZE_BYTES) || 100 * 1024;
    if (file.size > maxBytes) {
      renderRulePackStatus({
        valid: false,
        errors: ['파일 크기가 최대 허용치(' + (maxBytes / 1024) + 'KB)를 초과했습니다.'],
      });
      rulepackFile.value = '';
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      rulepackInput.value = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsText(file);
  }

  lintBtn.addEventListener('click', runLint);
  clearBtn.addEventListener('click', clearAll);
  rulepackApplyBtn.addEventListener('click', applyRulePack);
  rulepackFile.addEventListener('change', loadRulePackFile);
})();
