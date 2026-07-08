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
  var currentMode      = 'guide-draft';
  var abortController  = null;
  var outputFocusTimer = null;
  var statusTimers     = [];
  var activeRunToken   = 0;

  /* ── DOM 참조 ── */
  var form             = document.getElementById('generator-form');
  var submitBtn        = document.getElementById('submit-btn');
  var pageSubtitleEl   = document.getElementById('page-subtitle');
  var modeEl           = document.getElementById('generator-mode');
  var modeHelpEl       = document.getElementById('mode-help');
  var agencyNameEl     = document.getElementById('agency-name');
  var agencyTypeEl     = document.getElementById('agency-type');
  var screenTypeEl     = document.getElementById('screen-type');
  var toneTargetEl     = document.getElementById('tone-target');
  var toneTargetGroup  = document.getElementById('tone-target-group');
  var taskBriefEl      = document.getElementById('task-brief');
  var taskBriefHelpEl  = document.getElementById('task-brief-help');
  var samplesLegendEl  = document.getElementById('samples-legend');
  var samplesHelpEl    = document.getElementById('samples-help');
  var sample1LabelEl   = document.getElementById('sample-1-label');
  var sample2LabelEl   = document.getElementById('sample-2-label');
  var sample3LabelEl   = document.getElementById('sample-3-label');
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
  var qualityReviewEl  = document.getElementById('quality-review');
  var qualityScoreEl   = document.getElementById('quality-score');
  var qualityErrorsEl  = document.getElementById('quality-errors');
  var qualityWarningsEl = document.getElementById('quality-warnings');
  var qualityInfosEl   = document.getElementById('quality-infos');
  var qualityGatesEl   = document.getElementById('quality-gates');
  var qualityIssuesListEl = document.getElementById('quality-issues-list');
  var qualityEmptyEl   = document.getElementById('quality-empty');
  var usageGuideEl     = document.getElementById('usage-guide');
  var copyMdBtn        = document.getElementById('copy-md-btn');
  var downloadBtn      = document.getElementById('download-btn');
  var restartBtn       = document.getElementById('restart-btn');
  var downloadError    = document.getElementById('download-error');
  var dlChevron        = document.getElementById('dl-chevron');
  var dlMenu           = document.getElementById('dl-menu');

  // HTML 구조가 드리프트해도 페이지 전체가 깨지지 않도록 필수 노드를 검증한다.
  var requiredNodes = [
    form,
    submitBtn,
    agencyNameEl,
    agencyTypeEl,
    sample1El,
    sample2El,
    sample3El,
    formAlert,
    streamOutput,
    generatingStatus,
    generatingError,
    fallbackArea,
    cancelBtn,
    fallbackBtn,
    outputTitle,
    outputContent,
    copyMdBtn,
    downloadBtn,
    restartBtn,
    downloadError,
    dlChevron,
    dlMenu
  ];

  if (requiredNodes.some(function (node) { return !node; })) return;

  function getCurrentMode() {
    return modeEl && modeEl.value ? modeEl.value : 'guide-draft';
  }

  var MODE_CONFIG = {
    'guide-draft': {
      outputSuffix: 'UX Writing 가이드라인',
      subtitle: '기관명과 유형을 입력하고, 현재 서비스에서 사용 중인 UI 문구를 붙여넣으세요.<br>KRDS 3원칙 기반 맞춤 가이드라인 초안을 즉시 생성합니다.',
      modeHelp: '기관 전체 UX Writing 기준을 빠르게 초안화합니다.',
      samplesLegend: '현재 사용 중인 UI 문구',
      samplesHelp: '에러 메시지, 버튼 레이블, 안내문 등 현재 서비스에서 사용하는 문구를 그대로 붙여넣어 주세요.',
      sampleLabels: ['샘플 텍스트 1', '샘플 텍스트 2', '샘플 텍스트 3'],
      placeholders: [
        '예: 오류가 발생하였습니다. 담당 부서에 문의하시기 바랍니다.',
        '예: 해당 항목은 필수 입력 사항입니다.',
        '예: 신청서 제출이 완료되었습니다.'
      ],
      taskBriefHelp: '우선 다뤄야 할 화면, 서비스 흐름, 특정 문체 요구가 있으면 적어 주세요.',
      usageGuide: '이 가이드라인을 내부 문서로 활용하거나 출력하여 결재 자료로 사용하세요.',
      showToneTarget: false,
      statusSteps: [
        { delay: 0, msg: '기관 정보를 분석하고 있습니다…' },
        { delay: 3000, msg: 'KRDS 3대 원칙을 적용하고 있습니다…' },
        { delay: 8000, msg: '맞춤 가이드라인을 작성하고 있습니다…' },
        { delay: 15000, msg: '거의 다 됐습니다. 마무리 중입니다…' }
      ]
    },
    rewrite: {
      outputSuffix: 'UX Writing 재작성안',
      subtitle: '문장 단위 원문을 KRDS 기준으로 다시 씁니다.<br>Before/After와 최종 권장 문안을 함께 정리합니다.',
      modeHelp: '현재 문구를 KRDS 기준으로 바로 다시 쓰는 모드입니다.',
      samplesLegend: '재작성할 원문',
      samplesHelp: '화면에 들어갈 실제 문장이나 문단을 붙여넣어 주세요. 여러 후보를 함께 비교하고 싶으면 2~3개까지 넣을 수 있습니다.',
      sampleLabels: ['원문 1', '원문 2', '원문 3'],
      placeholders: [
        '예: 귀하의 신청서가 정상적으로 접수되었음을 알려드립니다.',
        '예: 상기 내용을 확인 후 다음 단계로 진행하시기 바랍니다.',
        '예: 처리 결과는 추후 별도 통지 예정입니다.'
      ],
      taskBriefHelp: '특정 화면이나 꼭 유지해야 할 정책 문구가 있으면 적어 주세요.',
      usageGuide: '권장 문안을 화면 설계안과 나란히 두고 바로 반영 여부를 판단하세요.',
      showToneTarget: false,
      statusSteps: [
        { delay: 0, msg: '원문을 읽고 문제를 찾고 있습니다…' },
        { delay: 2500, msg: 'KRDS 기준으로 다시 쓰고 있습니다…' },
        { delay: 7000, msg: 'Before/After와 최종 권장안을 정리하고 있습니다…' }
      ]
    },
    'message-pack': {
      outputSuffix: '상태 메시지 개선안',
      subtitle: '오류·완료·빈 상태·로딩처럼 상태 문구가 필요한 화면을 정리합니다.<br>필요한 유형이 비어 있으면 새 예시까지 제안합니다.',
      modeHelp: '상태별 메시지 묶음을 한 번에 정리하는 모드입니다.',
      samplesLegend: '상태 메시지 입력',
      samplesHelp: '현재 쓰는 오류·완료·안내 문장을 붙여넣어 주세요. 없는 상태는 비워 두면 필요한 예시를 새로 제안합니다.',
      sampleLabels: ['상태 메시지 1', '상태 메시지 2', '상태 메시지 3'],
      placeholders: [
        '예: ERROR 4023: 인증 실패. 다시 시도해 주세요.',
        '예: 신청서 제출이 완료되었습니다.',
        '예: 검색 결과가 없습니다.'
      ],
      taskBriefHelp: '우선 다룰 상태나 버튼명, 다음 행동 문구가 있으면 적어 주세요.',
      usageGuide: '상태 메시지별로 바로 복사해 적용할 수 있도록 권장 문구 묶음을 확인하세요.',
      showToneTarget: false,
      statusSteps: [
        { delay: 0, msg: '상태 메시지 흐름을 정리하고 있습니다…' },
        { delay: 2500, msg: '오류·완료·빈 상태 문구를 보완하고 있습니다…' },
        { delay: 7000, msg: '상황·이유·다음 행동 구조를 맞추고 있습니다…' }
      ]
    },
    'tone-adjust': {
      outputSuffix: '톤 조정안',
      subtitle: '현재 문구의 내용은 유지하되 목표 톤에 맞게 다시 조정합니다.<br>어조 차이와 최종 권장 문안을 함께 제공합니다.',
      modeHelp: '기관 보이스는 유지하면서 상황에 맞는 톤으로 조정하는 모드입니다.',
      samplesLegend: '톤을 조정할 문구',
      samplesHelp: '현재 문장을 붙여넣고 목표 톤을 고르면, 말투 차이와 권장 문안을 함께 제안합니다.',
      sampleLabels: ['조정 대상 1', '조정 대상 2', '조정 대상 3'],
      placeholders: [
        '예: 반드시 확인하여야 합니다.',
        '예: 빠르게 처리해 드리겠습니다.',
        '예: 감사합니다! 잘하셨습니다.'
      ],
      taskBriefHelp: '더 단정하게, 더 친근하게 등 구체적인 어조 요청이 있으면 적어 주세요.',
      usageGuide: '같은 정보가 다른 톤에서 어떻게 달라지는지 비교하고 최종 문안을 선택하세요.',
      showToneTarget: true,
      statusSteps: [
        { delay: 0, msg: '현재 문장의 톤을 분석하고 있습니다…' },
        { delay: 2500, msg: '목표 톤에 맞게 표현을 조정하고 있습니다…' },
        { delay: 7000, msg: '차이점과 최종 권장 문안을 정리하고 있습니다…' }
      ]
    },
    'derivative-guide': {
      outputSuffix: 'Layer 3 파생 가이드 초안',
      subtitle: '기관별 서비스 맥락을 반영한 Layer 3 파생 가이드 초안을 만듭니다.<br>전문용어 사전, 톤 기준, 오류 시나리오, 체크리스트까지 한 번에 정리합니다.',
      modeHelp: '기관 맞춤 Layer 3 파생 가이드를 빠르게 초안화하는 모드입니다.',
      samplesLegend: '기관 맥락 입력',
      samplesHelp: '핵심 서비스 문구, 자주 쓰는 용어, 대표 화면 문장을 넣어 주세요. 이 내용을 바탕으로 Layer 3 구조를 채웁니다.',
      sampleLabels: ['기관 샘플 1', '기관 샘플 2', '기관 샘플 3'],
      placeholders: [
        '예: 전시 예약이 완료되었습니다. 당일 QR 코드로 입장해 주세요.',
        '예: 도슨트 예약은 하루 전까지 취소할 수 있습니다.',
        '예: 검색 결과가 없습니다. 다른 전시명이나 기간으로 다시 찾아보세요.'
      ],
      taskBriefHelp: '핵심 서비스 흐름, 꼭 넣을 전문용어, 기관 특수 톤 요구가 있으면 적어 주세요.',
      usageGuide: 'Layer 3 파생 가이드 초안을 바탕으로 기관 검토 회의를 바로 시작할 수 있습니다.',
      showToneTarget: false,
      statusSteps: [
        { delay: 0, msg: '기관 맥락과 핵심 서비스 흐름을 분석하고 있습니다…' },
        { delay: 3000, msg: '전문용어 사전과 톤 기준을 정리하고 있습니다…' },
        { delay: 8000, msg: '오류 시나리오와 체크리스트를 채우고 있습니다…' }
      ]
    }
  };

  function isActiveRun(runToken) {
    return runToken === activeRunToken;
  }

  function clearOutputFocusTimer() {
    if (!outputFocusTimer) return;
    clearTimeout(outputFocusTimer);
    outputFocusTimer = null;
  }

  function clearStatusTimers() {
    statusTimers.forEach(function (timerId) { clearTimeout(timerId); });
    statusTimers = [];
  }

  function getModeConfig(mode) {
    return MODE_CONFIG[mode] || MODE_CONFIG['guide-draft'];
  }

  function setTextIfPresent(node, text) {
    if (node) node.textContent = text;
  }

  function setHtmlIfPresent(node, html) {
    if (node) node.innerHTML = html;
  }

  function getOutputHeading(agencyName, mode) {
    var safeAgency = agencyName || '기관';
    return safeAgency + ' ' + getModeConfig(mode).outputSuffix;
  }

  function getStatusSteps(mode) {
    return getModeConfig(mode).statusSteps || MODE_CONFIG['guide-draft'].statusSteps;
  }

  /* ── 화면 전환 ── */
  function showScreen(id) {
    if (id !== 'screen-output') clearOutputFocusTimer();
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

  function getModeSamples(mode, agencyType) {
    if (mode === 'guide-draft' || mode === 'derivative-guide') {
      return TYPE_SAMPLES[agencyType] || TYPE_SAMPLES['기타공공기관'] || [];
    }

    if (mode === 'rewrite') {
      return [
        '귀하의 신청서가 정상적으로 접수되었음을 알려드립니다.',
        '상기 내용을 확인 후 다음 단계로 진행하시기 바랍니다.',
        '처리 결과는 추후 별도 통지 예정입니다.'
      ];
    }

    if (mode === 'message-pack') {
      return [
        'ERROR 4023: 인증 실패. 다시 시도해 주세요.',
        '신청이 완료되었습니다. 감사합니다!',
        '검색 결과가 없습니다.'
      ];
    }

    if (mode === 'tone-adjust') {
      return [
        '반드시 확인하여야 합니다.',
        '빠르게 처리해 드리겠습니다.',
        '감사합니다! 잘하셨습니다.'
      ];
    }

    return TYPE_SAMPLES['기타공공기관'] || [];
  }

  function applyModeUi(mode, preserveFilledSamples) {
    var config = getModeConfig(mode);
    currentMode = mode;

    setHtmlIfPresent(pageSubtitleEl, config.subtitle);
    setTextIfPresent(modeHelpEl, config.modeHelp);
    setTextIfPresent(samplesLegendEl, config.samplesLegend);
    setTextIfPresent(samplesHelpEl, config.samplesHelp);
    setHtmlIfPresent(sample1LabelEl, escapeHtml(config.sampleLabels[0]) + '<span class="required-mark" aria-hidden="true"> *</span>');
    setHtmlIfPresent(sample2LabelEl, escapeHtml(config.sampleLabels[1]) + '<span class="optional-mark">(선택)</span>');
    setHtmlIfPresent(sample3LabelEl, escapeHtml(config.sampleLabels[2]) + '<span class="optional-mark">(선택)</span>');
    setTextIfPresent(taskBriefHelpEl, config.taskBriefHelp);
    setTextIfPresent(usageGuideEl, config.usageGuide);

    if (sample1El) sample1El.placeholder = config.placeholders[0];
    if (sample2El) sample2El.placeholder = config.placeholders[1];
    if (sample3El) sample3El.placeholder = config.placeholders[2];
    if (toneTargetGroup) {
      toneTargetGroup.style.display = config.showToneTarget ? '' : 'none';
    }

    if (!preserveFilledSamples) {
      var currentHasValues = sample1El.value.trim() || sample2El.value.trim() || sample3El.value.trim();
      if (!currentHasValues) {
        var samples = getModeSamples(mode, agencyTypeEl.value);
        sample1El.value = samples[0] || '';
        sample2El.value = samples[1] || '';
        sample3El.value = samples[2] || '';
        setFieldError('sample-1', false);
      }
    }

    validateForm();
  }

  agencyTypeEl.addEventListener('change', function () {
    setFieldError('agency-type', false);
    var samples = getModeSamples(getCurrentMode(), this.value);
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

  if (modeEl) {
    modeEl.addEventListener('change', function () {
      applyModeUi(this.value);
    });
  }

  /* ── HTML 이스케이프 (DOMPurify 없을 때 fallback) ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderPlaintextFallback(text) {
    return '<pre style="white-space:pre-wrap;word-break:break-word;">' +
      escapeHtml(text) + '</pre>';
  }

  /* ── 클립보드 복사 헬퍼 ── */
  function copyToClipboard(text, btn, label) {
    var origHtml = btn ? btn.textContent : null;
    var actionId = btn ? ((btn.__copyActionId || 0) + 1) : 0;
    function isLatestAction() {
      return !btn || btn.__copyActionId === actionId;
    }
    if (btn) btn.__copyActionId = actionId;
    function queueReset() {
      if (!btn) return;
      if (!isLatestAction()) return;
      if (btn.__copyResetTimer) clearTimeout(btn.__copyResetTimer);
      btn.__copyResetTimer = setTimeout(function () {
        btn.textContent = label || origHtml;
        btn.__copyResetTimer = null;
      }, 2000);
    }
    function onSuccess() {
      if (btn) {
        if (!isLatestAction()) return;
        btn.textContent = '✅ 복사됨';
        queueReset();
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
        if (!isLatestAction()) return;
        btn.textContent = ok ? '✅ 복사됨' : '❌ 복사 실패';
        queueReset();
      }
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFail);
    } else {
      onFail();
    }
  }

  /* ── 마크다운 → 안전한 HTML ── */
  function renderMarkdown(text) {
    if (!mdAvailable) {
      return renderPlaintextFallback(text);
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
    return renderPlaintextFallback(text);
  }

  function resetQualityReview() {
    if (!qualityReviewEl) return;
    qualityReviewEl.hidden = true;
    if (qualityScoreEl) qualityScoreEl.textContent = '-';
    if (qualityErrorsEl) qualityErrorsEl.textContent = '0';
    if (qualityWarningsEl) qualityWarningsEl.textContent = '0';
    if (qualityInfosEl) qualityInfosEl.textContent = '0';
    if (qualityGatesEl) qualityGatesEl.innerHTML = '';
    if (qualityIssuesListEl) qualityIssuesListEl.innerHTML = '';
    if (qualityEmptyEl) qualityEmptyEl.hidden = true;
  }

  function getLintEngine() {
    if (typeof KRDSLint !== 'undefined' && KRDSLint && typeof KRDSLint.lint === 'function') {
      return KRDSLint;
    }
    if (typeof window !== 'undefined' &&
        window.KRDSLint &&
        typeof window.KRDSLint.lint === 'function') {
      return window.KRDSLint;
    }
    return null;
  }

  function extractReviewText(markdownText) {
    var lines = String(markdownText || '')
      .replace(/```[\s\S]*?```/g, '\n')
      .split('\n');
    var reviewLines = [];

    lines.forEach(function (line) {
      var trimmed = String(line || '').trim();
      if (!trimmed) return;
      if (/^```/.test(trimmed)) return;
      if (/^(샘플 텍스트|원문 텍스트)\s*\d+\s*:/.test(trimmed)) return;
      if (/^[-*]\s*(현재|원문|문제)\s*:/.test(trimmed)) return;
      if (/^🚫/.test(trimmed)) return;
      if (/^\|[-\s:|]+\|$/.test(trimmed)) return;

      if (/^✅/.test(trimmed)) {
        reviewLines.push(trimmed.replace(/^✅\s*(개선:?)?\s*/, ''));
        return;
      }

      if (/^\|/.test(trimmed)) {
        var cells = trimmed
          .split('|')
          .map(function (cell) { return cell.trim(); })
          .filter(Boolean);

        if (!cells.length) return;
        if (/^(현재|원문|문제|before|b\s*\(현재\))/i.test(cells[0])) {
          cells = cells.slice(1);
        } else if (cells.length >= 3) {
          cells = cells.slice(1);
        }
        if (cells.length) {
          reviewLines.push(cells.join(' '));
        }
        return;
      }

      var normalized = trimmed
        .replace(/^#+\s*/, '')
        .replace(/^\*\*구조:\*\*\s*/i, '')
        .replace(/^개선:\s*/i, '')
        .replace(/^권장\s*문안:\s*/i, '')
        .replace(/^추천\s*문안:\s*/i, '')
        .replace(/^최종\s*문안:\s*/i, '')
        .replace(/^-\s*/, '');

      if (!normalized || /^(현재 표현|원문|문제|샘플 텍스트)/i.test(normalized)) return;
      reviewLines.push(normalized);
    });

    return reviewLines.join('\n').trim();
  }

  function countIssuesByTypes(issues, typeIds) {
    return issues.filter(function (issue) {
      return typeIds.indexOf(issue.type) !== -1;
    }).length;
  }

  function countLongSentences(text) {
    return String(text || '')
      .split(/[.!?\n]/)
      .map(function (sentence) { return sentence.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean)
      .filter(function (sentence) { return sentence.length > 72; })
      .length;
  }

  function getGateClass(status) {
    if (status === '통과') return 'pass';
    if (status === '주의') return 'warn';
    return 'fail';
  }

  function evaluateQualityGates(lintResult, reviewText, mode) {
    var issues = lintResult.issues || [];
    var noTranslationCount = countIssuesByTypes(issues, ['admin-jargon']);
    var distillationCount = countIssuesByTypes(issues, ['double-passive', 'subjective-adverb', 'noun-chain']);
    var safetyCount = countIssuesByTypes(issues, ['standalone-error-retry', 'error-code-standalone']);
    var voiceCount = countIssuesByTypes(issues, ['excessive-honorific', 'forbidden-char-excl']);
    var longSentenceCount = countLongSentences(reviewText);
    var actionCue = /(확인해 주세요|입력해 주세요|다시 .* 주세요|문의해 주세요|선택해 주세요|눌러 주세요|이용해 주세요)/.test(reviewText);
    var structureCue = /(상황|이유|다음 행동)/.test(reviewText);
    var emojiCount = (reviewText.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;

    return [
      {
        label: '무번역',
        status: noTranslationCount === 0 ? '통과' : '보완 필요',
        description: noTranslationCount === 0
          ? '행정어·금지 표현이 자동 검사에서 잡히지 않았습니다.'
          : '행정어·금지 표현이 ' + noTranslationCount + '건 남아 있습니다.',
        action: '기관 내부 용어도 가능한 한 일상어로 다시 풀어 쓰세요.'
      },
      {
        label: '정보핵심화',
        status: (distillationCount === 0 && longSentenceCount === 0)
          ? '통과'
          : ((distillationCount <= 2 && longSentenceCount <= 1) ? '주의' : '보완 필요'),
        description: (distillationCount === 0 && longSentenceCount === 0)
          ? '장문·군더더기 표현 위험이 크지 않습니다.'
          : '군더더기 패턴 ' + distillationCount + '건, 긴 문장 ' + longSentenceCount + '개가 보입니다.',
        action: '결론을 앞에 두고, 한 문장에 한 판단만 남기세요.'
      },
      {
        label: '심리적 안전망',
        status: (safetyCount === 0 && (actionCue || structureCue || mode === 'rewrite' || mode === 'tone-adjust'))
          ? '통과'
          : (safetyCount === 0 ? '주의' : '보완 필요'),
        description: safetyCount === 0
          ? ((actionCue || structureCue)
            ? '다음 행동 신호가 포함되어 있습니다.'
            : '직접적인 오류 구조 표지는 적지만 재시도형 금지 패턴은 없습니다.')
          : '상황·행동이 부족한 오류 패턴이 ' + safetyCount + '건 있습니다.',
        action: '오류·완료 문구에는 상황, 이유, 다음 행동을 분리해 적으세요.'
      },
      {
        label: '보이스·톤',
        status: (voiceCount === 0 && emojiCount === 0)
          ? '통과'
          : ((voiceCount <= 1 && emojiCount === 0) ? '주의' : '보완 필요'),
        description: (voiceCount === 0 && emojiCount === 0)
          ? '과잉 존칭, 과도한 감탄 표현이 자동 검사에서 보이지 않습니다.'
          : '톤 일관성을 해치는 표현이 감지됐습니다. (과잉 존칭 ' + voiceCount + '건, 이모지 ' + emojiCount + '개)',
        action: '기관 보이스는 유지하되 과잉 존칭, 감탄, 칭찬 표현은 줄이세요.'
      }
    ];
  }

  function renderQualityReview(markdownText, mode) {
    if (!qualityReviewEl || !qualityGatesEl || !qualityIssuesListEl) return;

    var lintEngine = getLintEngine();
    var reviewText = extractReviewText(markdownText);
    resetQualityReview();
    qualityReviewEl.hidden = false;

    if (!lintEngine || !reviewText) {
      qualityGatesEl.innerHTML = '<div class="quality-empty">자동 검수 엔진을 불러오지 못했습니다. 최종 점검은 lint 도구에서 다시 확인해 주세요.</div>';
      if (qualityEmptyEl) {
        qualityEmptyEl.hidden = false;
        qualityEmptyEl.textContent = '자동 검수 결과를 만들지 못했습니다. lint 도구에서 다시 검사해 주세요.';
      }
      return;
    }

    var lintResult;
    try {
      lintResult = lintEngine.lint(reviewText);
    } catch (_) {
      qualityGatesEl.innerHTML = '<div class="quality-empty">자동 검수 계산 중 오류가 발생했습니다. lint 도구에서 다시 확인해 주세요.</div>';
      if (qualityEmptyEl) {
        qualityEmptyEl.hidden = false;
        qualityEmptyEl.textContent = '자동 검수 계산에 실패했습니다. lint 도구에서 다시 확인해 주세요.';
      }
      return;
    }

    if (qualityScoreEl) qualityScoreEl.textContent = String(lintResult.score);
    if (qualityErrorsEl) qualityErrorsEl.textContent = String(lintResult.summary.errors);
    if (qualityWarningsEl) qualityWarningsEl.textContent = String(lintResult.summary.warnings);
    if (qualityInfosEl) qualityInfosEl.textContent = String(lintResult.summary.infos);

    var gates = evaluateQualityGates(lintResult, reviewText, mode);
    qualityGatesEl.innerHTML = gates.map(function (gate) {
      var className = 'quality-gate quality-gate--' + getGateClass(gate.status);
      return '<article class="' + className + '">' +
        '<div class="quality-gate-head">' +
          '<div class="quality-gate-label">' + escapeHtml(gate.label) + '</div>' +
          '<span class="quality-gate-status">' + escapeHtml(gate.status) + '</span>' +
        '</div>' +
        '<div class="quality-gate-desc">' + escapeHtml(gate.description) + '</div>' +
        '<div class="quality-gate-action">다음 조치: ' + escapeHtml(gate.action) + '</div>' +
      '</article>';
    }).join('');

    var topIssues = (lintResult.issues || []).slice(0, 5);
    if (!topIssues.length) {
      if (qualityEmptyEl) {
        qualityEmptyEl.hidden = false;
      }
      return;
    }

    if (qualityEmptyEl) qualityEmptyEl.hidden = true;
    qualityIssuesListEl.innerHTML = topIssues.map(function (issue) {
      return '<li class="quality-issue-item">' +
        '<div class="quality-issue-category">' + escapeHtml(issue.category || issue.type || '검수 항목') + '</div>' +
        '<div class="quality-issue-message">' + escapeHtml(issue.message || '') + '</div>' +
        '<div class="quality-issue-suggestion">' + escapeHtml(issue.suggestion || '') + '</div>' +
      '</li>';
    }).join('');
  }

  /* ── Fallback 마크다운 ── */
  function getFallbackMarkdown(agencyName, mode) {
    if (mode === 'rewrite') {
      return '# ' + agencyName + ' UX Writing 재작성안 (기본 양식)\n\n' +
        '## 1. 재작성 대상 요약\n\n' +
        '- 현재 문장을 KRDS 기준으로 다시 정리해야 합니다.\n\n' +
        '## 2. Before / After\n\n' +
        '| 원문 | 권장 문안 | 적용 원칙 |\n|---|---|---|\n| ... | ... | 무번역 / 정보핵심화 |\n\n' +
        '## 3. 최종 권장 문안\n\n- ...\n';
    }

    if (mode === 'message-pack') {
      return '# ' + agencyName + ' 상태 메시지 개선안 (기본 양식)\n\n' +
        '## 1. 오류 메시지\n\n- 상황: ...\n- 이유: ...\n- 다음 행동: ...\n\n' +
        '## 2. 완료 메시지\n\n- 완료 사실: ...\n- 다음 일정: ...\n\n' +
        '## 3. 빈 상태 / 로딩\n\n- 빈 상태: ...\n- 로딩: ...\n';
    }

    if (mode === 'tone-adjust') {
      return '# ' + agencyName + ' 톤 조정안 (기본 양식)\n\n' +
        '## 1. 현재 톤 진단\n\n- 현재 문장의 어조를 짧게 설명합니다.\n\n' +
        '## 2. 조정 방향\n\n- 유지할 요소: ...\n- 바꿀 요소: ...\n\n' +
        '## 3. 권장 문안\n\n- ...\n';
    }

    if (mode === 'derivative-guide') {
      return '# ' + agencyName + ' Layer 3 파생 가이드 초안 (기본 양식)\n\n' +
        '## 1. 핵심 서비스 흐름\n\n- 흐름 1: ...\n- 흐름 2: ...\n- 흐름 3: ...\n\n' +
        '## 2. 전문용어 추가 사전\n\n| 원어 | 대체어 | 맥락 |\n|---|---|---|\n| ... | ... | ... |\n\n' +
        '## 3. 톤 기준 / 오류 시나리오 / 체크리스트\n\n- ...\n';
    }

    return '# ' + agencyName + ' UX Writing 기본 가이드라인 (기본 양식)\n\n' +
      '## 1. 무번역 원칙\n\n' +
      '- [ ] 행정 용어를 시민 언어로 전환했는가?\n\n' +
      '## 2. 정보핵심화 원칙\n\n' +
      '- [ ] 불필요한 수식어를 제거했는가?\n\n' +
      '## 3. 심리적 안전망 원칙\n\n' +
      '- [ ] 오류 메시지에 다음 행동을 명시했는가?\n';
  }

  /* ── 독립 실행형 HTML 빌드 ── */
  function normalizeOutputMeta(meta) {
    return {
      agencyName: meta && meta.agencyName ? meta.agencyName : (currentAgency || '기관'),
      mode: meta && meta.mode ? meta.mode : (currentMode || 'guide-draft')
    };
  }

  function buildStandaloneHtml(meta, markdownText) {
    var normalizedMeta = normalizeOutputMeta(meta);
    var title   = escapeHtml(getOutputHeading(normalizedMeta.agencyName, normalizedMeta.mode));
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
  function showOutput(markdownText, meta) {
    var normalizedMeta = normalizeOutputMeta(meta);
    clearStatusTimers();
    currentMarkdown = markdownText;
    currentAgency   = normalizedMeta.agencyName;
    currentMode     = normalizedMeta.mode;
    outputTitle.textContent = getOutputHeading(normalizedMeta.agencyName, normalizedMeta.mode);
    outputContent.innerHTML = renderMarkdown(markdownText);
    renderQualityReview(markdownText, normalizedMeta.mode);
    setTextIfPresent(usageGuideEl, getModeConfig(normalizedMeta.mode).usageGuide);
    showScreen('screen-output');
    /* 포커스 이동 (스크린리더 알림) */
    clearOutputFocusTimer();
    outputFocusTimer = setTimeout(function () {
      outputFocusTimer = null;
      var outputScreen = document.getElementById('screen-output');
      if (!outputScreen || !outputScreen.classList || !outputScreen.classList.contains('active')) return;
      if (typeof outputTitle.focus === 'function') outputTitle.focus();
    }, 50);
  }

  /* ── 생성 중 에러 표시 ── */
  function showGeneratingError(msg, runToken) {
    if (typeof runToken === 'number' && !isActiveRun(runToken)) return;
    generatingError.textContent = msg || '가이드라인 생성 중 오류가 발생했습니다.';
    generatingError.classList.add('visible');
    clearStatusTimers();
    generatingStatus.textContent = '오류가 발생했습니다.';
    streamOutput.setAttribute('aria-busy', 'false');
    fallbackArea.style.display = 'block';
  }

  function handleSseEvent(evt, payload, runToken) {
    if (!evt || typeof evt !== 'object') return false;
    if (!isActiveRun(runToken)) return true;

    if (evt.type === 'chunk') {
      currentMarkdown += evt.text || '';
      streamOutput.textContent = currentMarkdown;
      return false;
    }

    if (evt.type === 'done') {
      streamOutput.setAttribute('aria-busy', 'false');
      showOutput(currentMarkdown, {
        agencyName: payload.agencyName,
        mode: payload.mode || 'guide-draft'
      });
      return true;
    }

    if (evt.type === 'error') {
      streamOutput.setAttribute('aria-busy', 'false');
      showGeneratingError(evt.message || '가이드라인 생성 중 오류가 발생했습니다.', runToken);
      return true;
    }

    return false;
  }

  function getSseDataPayload(line) {
    var trimmed = String(line || '').trim();
    if (!trimmed.startsWith('data:')) return null;

    var data = trimmed.slice(5);
    return data.charAt(0) === ' ' ? data.slice(1) : data;
  }

  function processSseLine(line, payload, runToken) {
    var jsonStr = getSseDataPayload(line);
    if (jsonStr === null) return false;
    try {
      return handleSseEvent(JSON.parse(jsonStr), payload, runToken);
    } catch (_) {
      return false;
    }
  }

  function getGenerateApiPath() {
    var basePath = window.KRDSBasePath;
    if (basePath && typeof basePath.buildSitePath === 'function') {
      return basePath.buildSitePath('/api/generate');
    }
    return '/api/generate';
  }

  /* ── SSE 스트리밍 ── */
  async function startGeneration(payload) {
    activeRunToken += 1;
    var runToken = activeRunToken;
    abortController = new AbortController();
    currentMarkdown = '';
    currentMode = payload.mode || 'guide-draft';

    streamOutput.textContent = '';
    streamOutput.setAttribute('aria-busy', 'true');
    generatingError.classList.remove('visible');
    generatingError.textContent = '';
    fallbackArea.style.display  = 'none';
    cancelBtn.textContent = '취소하기';
    resetQualityReview();

    clearStatusTimers();
    statusTimers = getStatusSteps(payload.mode).map(function(step) {
      return setTimeout(function() {
        if (isActiveRun(runToken) && generatingStatus) {
          generatingStatus.textContent = step.msg;
        }
      }, step.delay);
    });

    showScreen('screen-generating');

    var signal = abortController.signal;

    try {
      var response = await fetch(getGenerateApiPath(), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  signal
      });

      if (!isActiveRun(runToken)) return;

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
        showGeneratingError(errMsg, runToken);
        return;
      }

      if (!response.body || typeof response.body.getReader !== 'function') {
        showGeneratingError('응답 스트림을 읽을 수 없습니다. 다시 시도해 주세요.', runToken);
        return;
      }

      var reader  = response.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer  = '';

      /* ── CRITICAL: 네트워크 오류 대응 — 루프 전체 try/catch ── */
      try {
        while (true) {
          var chunk = await reader.read();
          if (!isActiveRun(runToken)) return;
          if (chunk.done) break;

          buffer += decoder.decode(chunk.value, { stream: true });

          /* SSE 이벤트 파싱 */
          var lines = buffer.split('\n');
          buffer = lines.pop(); /* 불완전한 마지막 라인 보관 */

          for (var i = 0; i < lines.length; i++) {
            if (processSseLine(lines[i].trim(), payload, runToken)) return;
          }
        }

        if (!isActiveRun(runToken)) return;
        buffer += decoder.decode();
        if (processSseLine(buffer.trim(), payload, runToken)) return;

        streamOutput.setAttribute('aria-busy', 'false');
        if (currentMarkdown) {
          showOutput(currentMarkdown, {
            agencyName: payload.agencyName,
            mode: payload.mode || 'guide-draft'
          });
        } else {
          showGeneratingError(
            '응답을 끝까지 받지 못했습니다. 다시 시도하거나 기본 양식을 사용해 주세요.',
            runToken
          );
        }
      } catch (readErr) {
        if (readErr.name === 'AbortError' || !isActiveRun(runToken)) return;
        streamOutput.setAttribute('aria-busy', 'false');
        showGeneratingError(
          '연결이 끊겼습니다. 다시 시도하거나 기본 양식을 사용해 주세요.',
          runToken
        );
      }

    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError' || !isActiveRun(runToken)) return;
      streamOutput.setAttribute('aria-busy', 'false');
      showGeneratingError(
        '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.',
        runToken
      );
    }
  }

  /* ── 폼 제출 ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = agencyNameEl.value.trim();
    var mode = getCurrentMode();
    var type = agencyTypeEl.value;
    var screenType = screenTypeEl && screenTypeEl.value ? screenTypeEl.value : '';
    var toneTarget = toneTargetEl && toneTargetEl.value ? toneTargetEl.value : '';
    var taskBrief = taskBriefEl && taskBriefEl.value ? taskBriefEl.value.trim() : '';
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

    startGeneration({
      mode: mode,
      agencyName: name,
      agencyType: type,
      screenType: screenType,
      toneTarget: toneTarget,
      taskBrief: taskBrief,
      samples: samples
    });
  });

  /* ── 취소하기 ── */
  cancelBtn.addEventListener('click', function () {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    activeRunToken += 1;
    currentMarkdown = '';
    streamOutput.setAttribute('aria-busy', 'false');
    clearStatusTimers();
    resetQualityReview();
    showScreen('screen-input');
  });

  /* ── 기본 양식 사용하기 ── */
  fallbackBtn.addEventListener('click', function () {
    var agencyName = agencyNameEl.value.trim() || '기관';
    var mode = getCurrentMode();
    showOutput(getFallbackMarkdown(agencyName, mode), {
      agencyName: agencyName,
      mode: mode
    });
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
      var html = buildStandaloneHtml({
        agencyName: currentAgency || '기관',
        mode: currentMode || 'guide-draft'
      }, currentMarkdown);
      var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href     = url;
      a.download = getOutputHeading(currentAgency || '기관', currentMode || 'guide-draft') + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (_) {
      downloadError.textContent = 'HTML 다운로드에 실패했습니다. 다시 시도해 주세요.';
      downloadError.classList.add('visible');
    }
  }

  downloadBtn.addEventListener('click', downloadHtml);

  /* ── 다운로드 드롭다운 ── */
  function closeDlMenu(restoreFocus) {
    dlMenu.classList.remove('open');
    dlChevron.setAttribute('aria-expanded', 'false');
    if (restoreFocus && typeof dlChevron.focus === 'function') {
      dlChevron.focus();
    }
  }

  function findClosest(target, selector) {
    return target && typeof target.closest === 'function'
      ? target.closest(selector)
      : null;
  }

  function closeDlMenuForTab(shiftKey) {
    if (shiftKey) {
      closeDlMenu(true);
    } else {
      closeDlMenu(false);
      if (typeof restartBtn.focus === 'function') restartBtn.focus();
    }
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
    var item = findClosest(e.target, '.dl-menu-item');
    if (!item) return;
    var fmt = item.dataset.format;
    closeDlMenu(true);
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
    if (!items.length) {
      if (e.key === 'Tab') {
        e.preventDefault();
        closeDlMenuForTab(e.shiftKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDlMenu(true);
      }
      return;
    }
    var idx   = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1) % items.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length].focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      closeDlMenuForTab(e.shiftKey);
    } else if (e.key === 'Escape') {
      closeDlMenu(true);
    }
  });

  document.addEventListener('click', function (e) {
    if (!findClosest(e.target, '.dl-btn-group')) closeDlMenu();
  });

  /* ── 다시 생성하기 ── */
  restartBtn.addEventListener('click', function () {
    resetQualityReview();
    showScreen('screen-input');
  });

  /* ── URL 파라미터 프리필 ── */
  (function applyUrlParams() {
    if (typeof location === 'undefined' || !location.search) return;
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }

    var TEMPLATE_MODE_MAP = {
      'error-message':    'message-pack',
      'message-pack':     'message-pack',
      'rewrite':          'rewrite',
      'tone-adjust':      'tone-adjust',
      'guide-draft':      'guide-draft',
      'derivative-guide': 'derivative-guide'
    };

    var mode = params.get('mode') || TEMPLATE_MODE_MAP[params.get('template')] || null;
    if (mode && MODE_CONFIG[mode] && modeEl) {
      modeEl.value = mode;
    }

    var agency = params.get('agency');
    if (agency && agencyNameEl) agencyNameEl.value = agency;

    var agencyType = params.get('agency-type');
    if (agencyType && agencyTypeEl) agencyTypeEl.value = agencyType;

    var screenType = params.get('screen-type');
    if (screenType && screenTypeEl) screenTypeEl.value = screenType;
  }());

  applyModeUi(getCurrentMode(), false);

})();
