/**
 * offline-app/rulepack-validator.js — 기관 Rule Pack JSON import 검증
 *
 * 보안 원칙: JSON.parse만 사용한다. eval, new Function, Function 생성자를
 * 절대 사용하지 않는다. 모든 필드는 문자열/데이터로만 취급하며 실행하지 않는다.
 *
 * 브라우저 + Node.js 양쪽 호환 (krds-lint.js와 동일한 UMD 패턴)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    var schema = require('./rulepack-schema.js');
    module.exports = factory(schema);
  } else {
    root.KRDSRulePackValidator = factory(root.KRDSRulePackSchema);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Schema) {
  'use strict';

  function byteLength(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str).length;
    }
    return Buffer.byteLength(str, 'utf8');
  }

  function isValidDateString(str) {
    if (typeof str !== 'string' || !Schema.DATE_FORMAT_REGEX.test(str)) return false;
    var parts = str.split('-');
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    var date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function checkStringField(obj, field, limits, prefix, errors) {
    if (!(field in obj)) {
      errors.push(prefix + "'" + field + "' 필드가 없습니다.");
      return;
    }
    var value = obj[field];
    if (typeof value !== 'string') {
      errors.push(prefix + "'" + field + "' 필드는 문자열이어야 합니다.");
      return;
    }
    if (value.length < limits.min || value.length > limits.max) {
      errors.push(prefix + "'" + field + "' 필드는 " + limits.min + '자 이상 ' + limits.max + '자 이하이어야 합니다.');
    }
  }

  function validateEntry(entry, index, errors) {
    var prefix = 'entries[' + index + '] ';

    if (!Schema.isPlainObject(entry)) {
      errors.push(prefix + '항목이 객체가 아닙니다.');
      return;
    }

    ['term', 'agencyName', 'rationale', 'approver'].forEach(function (field) {
      checkStringField(entry, field, Schema.ENTRY_STRING_LIMITS[field], prefix, errors);
    });

    Schema.ENTRY_DATE_FIELDS.forEach(function (field) {
      if (!(field in entry)) {
        errors.push(prefix + "'" + field + "' 필드가 없습니다.");
        return;
      }
      if (!isValidDateString(entry[field])) {
        errors.push(prefix + "'" + field + "' 필드는 YYYY-MM-DD 형식의 유효한 날짜여야 합니다.");
      }
    });

    if (isValidDateString(entry.approvedDate) && isValidDateString(entry.reviewDate)) {
      if (entry.reviewDate < entry.approvedDate) {
        errors.push(prefix + "'reviewDate'는 'approvedDate'보다 이전일 수 없습니다.");
      }
    }
  }

  /**
   * Rule Pack JSON 문자열을 검증한다.
   * @param {string} jsonString
   * @returns {{valid:true,data:object}|{valid:false,errors:string[]}}
   */
  function validateRulePack(jsonString) {
    var errors = [];

    if (typeof jsonString !== 'string') {
      return { valid: false, errors: ['입력값이 문자열이 아닙니다.'] };
    }

    if (byteLength(jsonString) > Schema.MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        errors: ['파일 크기가 최대 허용치(' + (Schema.MAX_FILE_SIZE_BYTES / 1024) + 'KB)를 초과했습니다.'],
      };
    }

    var data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      return { valid: false, errors: ['유효한 JSON 형식이 아닙니다.'] };
    }

    if (!Schema.isPlainObject(data)) {
      return { valid: false, errors: ['최상위 값은 객체({ agencyName, version, entries }) 형태여야 합니다.'] };
    }

    checkStringField(data, 'agencyName', Schema.TOP_LEVEL_STRING_LIMITS.agencyName, '', errors);

    if (!('version' in data)) {
      errors.push("'version' 필드가 없습니다.");
    } else if (typeof data.version !== 'string' && typeof data.version !== 'number') {
      errors.push("'version' 필드는 문자열 또는 숫자여야 합니다.");
    }

    if (!('entries' in data)) {
      errors.push("'entries' 필드가 없습니다.");
    } else if (!Array.isArray(data.entries)) {
      errors.push("'entries' 필드는 배열이어야 합니다.");
    } else {
      if (data.entries.length > Schema.MAX_ENTRIES) {
        errors.push(
          "'entries' 배열은 최대 " + Schema.MAX_ENTRIES + '개까지 허용됩니다. (현재 ' + data.entries.length + '개)'
        );
      }
      data.entries.forEach(function (entry, index) {
        validateEntry(entry, index, errors);
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors: errors };
    }

    return { valid: true, data: data };
  }

  return {
    validateRulePack: validateRulePack,
  };
});
