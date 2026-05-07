(function () {
  'use strict';

  /* ── CDN 가용성 확인 ── */
  var purifyAvailable = typeof DOMPurify !== 'undefined';
  var mdAvailable     = typeof markdownit !== 'undefined';
  var md = mdAvailable
    ? markdownit({ html: false, breaks: true, linkify: false })
    : null;

  /* ── 앱 상태 ── */
  var currentMarkdown  = '';
  var currentAgency    = '';
  var abortController  = null;
  var cancelled        = false;
  var statusTimers     = [];

  /* ── DOM 참조 ── */
  var form             = document.getElementById('generator-form');
  var submitBtn        = document.getElementById('submit-btn');
  var agencyNameEl     = document.getElementById('agency-name');
  var agencyTypeEl     = document.getElementById('agency-type');
  var sample1El        = document.getElementById('sample-1');
  var sample2El        = document.getElementById('sample-2');
  var sample3El        = document.getElementById('sample-3');
  var formAlert        = document.getElementById('form-alert');
  var streamOutput     = document.getElementById('stream-output');
  var generatingStatus = document.getElementById('generating-status');
  var generatingError  = document.getElementById('generating-error');
  var fallbackArea     = document.getElementById('fallback-area');
  var cancelBtn        = document.getElementById('cancel-btn');
  var fallbackBtn      = document.getElementById('fallback-btn');
  var outputTitle      = document.getElementById('output-title');
  var outputContent    = document.getElementById('output-content');
  var copyMdBtn        = document.getElementById('copy-md-btn');
  var downloadBtn      = document.getElementById('download-btn');
  var restartBtn       = document.getElementById('restart-btn');
  var downloadError    = document.getElementById('download-error');

  /* ── 화면 전환 ── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.remove('active');
    });
    var target = document.getElementById(id);
    if (!target) return;
    target.classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ── 필드 에러 토글 ── */
  function setFieldError(fieldId, show) {
    var field = document.getElementById(fieldId);
    var msg   = document.getElementById(fieldId + '-error');
    if (!field || !msg) return;
    if (show) {
      field.classList.add('has-error');
      msg.classList.add('visible');
    } else {
      field.classList.remove('has-error');
      msg.classList.remove('visible');
    }
  }

  /* ── 버튼 활성화 검사 ── */
  function validateForm() {
    var ok =
      agencyNameEl.value.trim().length > 0 &&
      agencyTypeEl.value !== '' &&
      sample1El.value.trim().length > 0;
    submitBtn.disabled = !ok;
  }

  /* ── 입력 이벤트 바인딩 ── */
  agencyNameEl.addEventListener('input', function () {
    setFieldError('agency-name', false);
    validateForm();
  });

  /* ── 기관 유형별 샘플 텍스트 (US-G02) ── */
  var TYPE_SAMPLES = {
    '지방자치단체': [
      '귀하의 주민등록 말소 사실을 통보하오니 이의신청 기간 내에 처분청에 이의제기 하시기 바랍니다.',
      '해당 민원은 소관 부서로 이첩 처리되었습니다. 불편을 드려 죄송합니다.',
      '신청서 접수가 완료되었습니다. 처리 기간은 7일이며 결과는 문자로 통보됩니다.'
    ],
    '광역자치단체': [
      '수급권자는 소명자료를 첨부하여 관할 주민센터에 제출하시기 바랍니다.',
      '해당 사업은 예산 소진으로 인하여 금일부로 접수가 종료되었습니다.',
      '귀 기관의 협조에 감사드리며 결재 완료 후 공문을 발송하겠습니다.'
    ],
    '중앙행정기관': [
      '귀책사유가 없는 경우 변상금 부과가 면제됩니다. 관련 서류를 제출하시기 바랍니다.',
      '동 사안은 관계 법령에 의거하여 처리되었음을 알려드립니다.',
      '상기 내용에 대하여 이의가 있는 경우 행정심판을 청구할 수 있습니다.'
    ],
    '공공기관': [
      'ERROR 4023: 인증 실패. 다시 시도해 주세요.',
      '해당 서비스는 점검 중으로 인하여 일시적으로 이용이 제한됩니다.',
      '회원 가입 완료. 서비스 이용을 위해 이메일 인증을 진행해 주시기 바랍니다.'
    ],
    '교육기관': [
      '수강신청 기간 내 미신청 시 해당 학기 수강이 불가합니다.',
      '장학금 수혜 대상자로 선발되었습니다. 구비서류를 제출하여 주시기 바랍니다.',
      '성적 이의신청은 공시일로부터 5일 이내 학사지원팀에 신청하시기 바랍니다.'
    ],
    '기타공공기관': [
      '신청이 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.',
      '해당 서비스는 현재 점검 중입니다. 잠시 후 다시 이용해 주세요.',
      '입력하신 정보가 일치하지 않습니다. 다시 확인해 주세요.'
    ]
  };

  agencyTypeEl.addEventListener('change', function () {
    setFieldError('agency-type', false);
    var samples = TYPE_SAMPLES[this.value];
    if (samples && !sample1El.value.trim() && !sample2El.value.trim() && !sample3El.value.trim()) {
      sample1El.value  = samples[0] || '';
      sample2El.value  = samples[1] || '';
      sample3El.value  = samples[2] || '';
      setFieldError('sample-1', false);
    }
    validateForm();
  });
  sample1El.addEventListener('input', function () {
    setFieldError('sample-1', false);
    validateForm();
  });
  sample2El.addEventListener('input', validateForm);
  sample3El.addEventListener('input', validateForm);

  /* ── HTML 이스케이프 (DOMPurify 없을 때 fallback) ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── 클립보드 복사 헬퍼 ── */
  function copyToClipboard(text, btn, label) {
    var origHtml = btn ? btn.textContent : null;
    function onSuccess() {
      if (btn) {
        btn.textContent = '✅ 복사됨';
        setTimeout(function () { btn.textContent = label || origHtml; }, 2000);
      }
    }
    function onFail() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      if (btn) {
        btn.textContent = ok ? '✅ 복사됨' : '❌ 복사 실패';
        setTimeout(function () { btn.textContent = label || origHtml; }, 2000);
      }
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFail);
    } else {
      onFail();
    }
  }

  /* ── 마크다운 → 안전한 HTML ── */
  function renderMarkdown(text) {
    if (!mdAvailable) {
      return '<pre style="white-space:pre-wrap;word-break:break-word;">' +
        escapeHtml(text) + '</pre>';
    }
    var raw = md.render(text);
    if (purifyAvailable) {
      return DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: [
          'h1','h2','h3','h4','h5','h6','p',
          'ul','ol','li','strong','em','code','pre',
          'table','thead','tbody','tr','th','td',
          'blockquote','br','hr'
        ]
      });
    }
    /* DOMPurify CDN 로드 실패 시 plaintext fallback */
    return '<pre style="white-space:pre-wrap;word-break:break-word;">' +
      escapeHtml(text) + '</pre>';
  }

  /* ── Fallback 마크다운 ── */
  function getFallbackMarkdown(agencyName) {
    return '# ' + agencyName + ' UX Writing 기본 가이드라인 (기본 양식)\n\n' +
      '## 1. 무번역 원칙\n\n' +
      '- [ ] 행정 용어를 시민 언어로 전환했는가?\n\n' +
      '## 2. 정보핵심화 원칙\n\n' +
      '- [ ] 불필요한 수식어를 제거했는가?\n\n' +
      '## 3. 심리적 안전망 원칙\n\n' +
      '- [ ] 오류 메시지에 다음 행동을 명시했는가?\n';
  }

  /* ── 독립 실행형 HTML 빌드 ── */
  function buildStandaloneHtml(agencyName, markdownText) {
    var title   = escapeHtml(agencyName) + ' UX Writing 가이드라인';
    var content = renderMarkdown(markdownText);
    var date    = new Date().toLocaleDateString('ko-KR');
    return [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head>',
      '<meta charset="UTF-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '<title>' + title + '</title>',
      '<style>',
      'body{font-family:\'Pretendard Variable\',Pretendard,-apple-system,sans-serif;',
      '  font-size:16px;line-height:1.7;color:#1a1a1a;max-width:800px;margin:0 auto;padding:32px 24px;}',
      'h1{font-size:24px;font-weight:700;margin-bottom:8px;}',
      'h2{font-size:18px;font-weight:700;margin-top:2em;margin-bottom:.5em;',
      '  border-bottom:1px solid #e5e7eb;padding-bottom:6px;}',
      'h3{font-size:16px;font-weight:700;margin-top:1.5em;margin-bottom:.5em;}',
      'ul,ol{padding-left:1.5em;margin-bottom:.75em;}',
      'li{margin-bottom:.3em;}',
      'table{width:100%;border-collapse:collapse;margin-bottom:.75em;font-size:14px;}',
      'th,td{border:1px solid #e5e7eb;padding:8px 12px;text-align:left;}',
      'th{background:#f8f9fa;font-weight:600;}',
      'code{background:#f8f9fa;padding:1px 5px;border-radius:3px;font-size:.9em;}',
      'pre{background:#f8f9fa;padding:12px;border-radius:6px;overflow-x:auto;}',
      'blockquote{border-left:3px solid #256ef4;padding-left:16px;color:#4b5563;}',
      '.meta{color:#6b7280;font-size:13px;margin-bottom:28px;',
      '  padding-bottom:14px;border-bottom:1px solid #e5e7eb;}',
      '</style>',
      '</head>',
      '<body>',
      '<p class="meta">KRDS UX Writing 가이드라인 생성기 · 생성일: ' + date + '</p>',
      content,
      '</body>',
      '</html>'
    ].join('\n');
  }

  /* ── 출력 화면 표시 ── */
  function showOutput(markdownText, agencyName) {
    statusTimers.forEach(function(t) { clearTimeout(t); });
    statusTimers = [];
    currentMarkdown = markdownText;
    currentAgency   = agencyName;
    outputTitle.textContent = agencyName + ' UX Writing 가이드라인';
    outputContent.innerHTML = renderMarkdown(markdownText);
    showScreen('screen-output');
    /* 포커스 이동 (스크린리더 알림) */
    setTimeout(function () { outputTitle.focus(); }, 50);
  }

  /* ── 생성 중 에러 표시 ── */
  function showGeneratingError(msg) {
    generatingError.textContent = msg || '가이드라인 생성 중 오류가 발생했습니다.';
    generatingError.classList.add('visible');
    statusTimers.forEach(function(t) { clearTimeout(t); });
    statusTimers = [];
    generatingStatus.textContent = '오류가 발생했습니다.';
    streamOutput.setAttribute('aria-busy', 'false');
    fallbackArea.style.display = 'block';
  }

  /* ── SSE 스트리밍 ── */
  async function startGeneration(payload) {
    abortController = new AbortController();
    cancelled       = false;
    currentMarkdown = '';

    streamOutput.textContent = '';
    streamOutput.setAttribute('aria-busy', 'true');
    generatingError.classList.remove('visible');
    generatingError.textContent = '';
    fallbackArea.style.display  = 'none';
    cancelBtn.textContent = '취소하기';

    /* ── US-G03: 단계 메시지 ── */
    statusTimers.forEach(function(t) { clearTimeout(t); });
    var STATUS_STEPS = [
      { delay: 0,    msg: '기관 정보를 분석하고 있습니다…' },
      { delay: 3000, msg: 'KRDS 3대 원칙을 적용하고 있습니다…' },
      { delay: 8000, msg: '맞춤 가이드라인을 작성하고 있습니다…' },
      { delay: 15000, msg: '거의 다 됐습니다. 마무리 중입니다…' },
    ];
    statusTimers = STATUS_STEPS.map(function(step) {
      return setTimeout(function() {
        if (generatingStatus) generatingStatus.textContent = step.msg;
      }, step.delay);
    });

    showScreen('screen-generating');

    var signal = abortController.signal;

    try {
      var response = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  signal
      });

      if (!response.ok) {
        var errData = null;
        try { errData = await response.json(); } catch (_) {}
        var errMsg = (errData && errData.error)
          ? errData.error
          : '서버 오류가 발생했습니다. (' + response.status + ')';
        if (response.status === 429) {
          errMsg = '요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.';
        } else if (response.status === 400) {
          errMsg = errData && errData.error
            ? errData.error
            : '입력값을 확인해 주세요.';
        }
        showGeneratingError(errMsg);
        return;
      }

      var reader  = response.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer  = '';

      /* ── CRITICAL: 네트워크 오류 대응 — 루프 전체 try/catch ── */
      try {
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;

          buffer += decoder.decode(chunk.value, { stream: true });

          /* SSE 이벤트 파싱 */
          var lines = buffer.split('\n');
          buffer = lines.pop(); /* 불완전한 마지막 라인 보관 */

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith('data: ')) continue;

            var jsonStr = line.slice(6);
            try {
              var evt = JSON.parse(jsonStr);

              if (evt.type === 'chunk') {
                currentMarkdown += evt.text;
                streamOutput.textContent = currentMarkdown;

              } else if (evt.type === 'done') {
                streamOutput.setAttribute('aria-busy', 'false');
                showOutput(currentMarkdown, payload.agencyName);
                return;

              } else if (evt.type === 'error') {
                streamOutput.setAttribute('aria-busy', 'false');
                showGeneratingError(evt.message || '가이드라인 생성 중 오류가 발생했습니다.');
                return;
              }
            } catch (_) {
              /* JSON 파싱 실패는 무시 (부분 청크) */
            }
          }
        }
      } catch (readErr) {
        streamOutput.setAttribute('aria-busy', 'false');
        if (readErr.name === 'AbortError') return;
        showGeneratingError(
          '연결이 끊겼습니다. 다시 시도하거나 기본 양식을 사용해 주세요.'
        );
      }

    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') return;
      streamOutput.setAttribute('aria-busy', 'false');
      showGeneratingError(
        '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'
      );
    }
  }

  /* ── 폼 제출 ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = agencyNameEl.value.trim();
    var type = agencyTypeEl.value;
    var s1   = sample1El.value.trim();
    var s2   = sample2El.value.trim();
    var s3   = sample3El.value.trim();

    var hasError = false;
    formAlert.classList.remove('visible');
    formAlert.textContent = '';

    if (!name || name.length > 50) {
      setFieldError('agency-name', true);
      hasError = true;
    }
    if (!type) {
      setFieldError('agency-type', true);
      hasError = true;
    }
    if (!s1) {
      setFieldError('sample-1', true);
      hasError = true;
    }

    if (hasError) {
      var firstBad = document.querySelector('.has-error');
      if (firstBad) firstBad.focus();
      return;
    }

    var samples = [s1];
    if (s2) samples.push(s2);
    if (s3) samples.push(s3);

    startGeneration({ agencyName: name, agencyType: type, samples: samples });
  });

  /* ── 취소하기 ── */
  cancelBtn.addEventListener('click', function () {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    cancelled = false;
    streamOutput.setAttribute('aria-busy', 'false');
    statusTimers.forEach(function(t) { clearTimeout(t); });
    statusTimers = [];
    showScreen('screen-input');
  });

  /* ── 기본 양식 사용하기 ── */
  fallbackBtn.addEventListener('click', function () {
    var agencyName = agencyNameEl.value.trim() || '기관';
    showOutput(getFallbackMarkdown(agencyName), agencyName);
  });

  /* ── 텍스트 복사 (US-G01) ── */
  copyMdBtn.addEventListener('click', function () {
    if (!currentMarkdown) return;
    copyToClipboard(currentMarkdown, copyMdBtn, '텍스트 복사');
  });

  /* ── 다운로드 (HTML) ── */
  function downloadHtml() {
    downloadError.classList.remove('visible');
    try {
      var html = buildStandaloneHtml(currentAgency || '기관', currentMarkdown);
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = (currentAgency || '기관') + '-uxwriting-guide.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (_) {
      downloadError.classList.add('visible');
    }
  }

  downloadBtn.addEventListener('click', downloadHtml);

  /* ── 다운로드 드롭다운 ── */
  var dlChevron = document.getElementById('dl-chevron');
  var dlMenu    = document.getElementById('dl-menu');

  function closeDlMenu() {
    dlMenu.classList.remove('open');
    dlChevron.setAttribute('aria-expanded', 'false');
  }

  dlChevron.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = dlMenu.classList.contains('open');
    if (isOpen) {
      closeDlMenu();
    } else {
      dlMenu.classList.add('open');
      dlChevron.setAttribute('aria-expanded', 'true');
      var firstItem = dlMenu.querySelector('.dl-menu-item');
      if (firstItem) firstItem.focus();
    }
  });

  dlMenu.addEventListener('click', function (e) {
    var item = e.target.closest('.dl-menu-item');
    if (!item) return;
    var fmt = item.dataset.format;
    closeDlMenu();
    if (fmt === 'html') {
      downloadHtml();
    } else {
      var fmtName = fmt === 'hwp' ? 'HWP' : 'Word';
      downloadError.classList.remove('visible');
      downloadError.textContent = fmtName + ' 변환에 실패했습니다. HTML로 다운로드해 주세요.';
      downloadError.classList.add('visible');
    }
  });

  dlMenu.addEventListener('keydown', function (e) {
    var items = Array.from(dlMenu.querySelectorAll('.dl-menu-item'));
    var idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Escape') {
      closeDlMenu();
      dlChevron.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dl-btn-group')) closeDlMenu();
  });

  /* ── 다시 생성하기 ── */
  restartBtn.addEventListener('click', function () {
    showScreen('screen-input');
  });

})();
