/**
 * offline-app/rulepack-schema.js — 기관 Rule Pack JSON 스키마 정의
 * 브라우저 + Node.js 양쪽 호환 (krds-lint.js와 동일한 UMD 패턴)
 * 데이터 정의만 담는다 — 검증 로직은 rulepack-validator.js 참고.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.KRDSRulePackSchema = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  var MAX_FILE_SIZE_BYTES = 100 * 1024; // 100KB
  var MAX_ENTRIES = 500;

  // 최상위 객체: { agencyName, version, entries: [...] }
  var TOP_LEVEL_STRING_LIMITS = {
    agencyName: { min: 1, max: 50 },
  };

  // entries[] 항목별 필드
  var ENTRY_STRING_LIMITS = {
    term: { min: 1, max: 50 },
    agencyName: { min: 1, max: 50 },
    rationale: { min: 1, max: 500 },
    approver: { min: 1, max: 50 },
  };

  var ENTRY_DATE_FIELDS = ['approvedDate', 'reviewDate'];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  return {
    DATE_FORMAT_REGEX: DATE_FORMAT_REGEX,
    MAX_FILE_SIZE_BYTES: MAX_FILE_SIZE_BYTES,
    MAX_ENTRIES: MAX_ENTRIES,
    TOP_LEVEL_STRING_LIMITS: TOP_LEVEL_STRING_LIMITS,
    ENTRY_STRING_LIMITS: ENTRY_STRING_LIMITS,
    ENTRY_DATE_FIELDS: ENTRY_DATE_FIELDS,
    isPlainObject: isPlainObject,
  };
});
