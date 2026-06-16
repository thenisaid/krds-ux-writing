(function () {
  'use strict';

  var DEPLOYMENT_PREFIX = '/krds-ux-writing';
  var SCRIPT_MARKER = '/shared/base-path.js';

  function trimTrailingSlash(value) {
    return value && value.length > 1 ? value.replace(/\/+$/, '') : (value || '');
  }

  function ensureLeadingSlash(value) {
    if (!value) return '/';
    return value.charAt(0) === '/' ? value : '/' + value;
  }

  function splitPathSuffix(value) {
    var raw = String(value || '');
    var suffixIndex = raw.search(/[?#]/);
    if (suffixIndex === -1) {
      return { path: raw, suffix: '' };
    }
    return {
      path: raw.slice(0, suffixIndex),
      suffix: raw.slice(suffixIndex),
    };
  }

  function getCurrentScriptSrc() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }

    var scripts = document.getElementsByTagName ? document.getElementsByTagName('script') : [];
    for (var i = scripts.length - 1; i >= 0; i--) {
      var script = scripts[i];
      var src = script.src || script.getAttribute('src') || '';
      if (src.indexOf('shared/base-path.js') !== -1) return src;
    }

    return '';
  }

  function getSiteRootPath() {
    var src = getCurrentScriptSrc();
    if (!src) return '';

    try {
      var scriptUrl = new URL(src, window.location.href);
      var scriptPath = scriptUrl.pathname;
      var markerIndex = scriptPath.lastIndexOf(SCRIPT_MARKER);
      if (markerIndex === -1) return '';
      return trimTrailingSlash(scriptPath.slice(0, markerIndex));
    } catch (e) {
      return '';
    }
  }

  var siteRootPath = getSiteRootPath();

  function stripDeploymentPrefix(pathname) {
    var parts = splitPathSuffix(pathname);
    var value = ensureLeadingSlash(parts.path);
    if (value === DEPLOYMENT_PREFIX) return '/' + parts.suffix;
    if (value.indexOf(DEPLOYMENT_PREFIX + '/') === 0) {
      return (value.slice(DEPLOYMENT_PREFIX.length) || '/') + parts.suffix;
    }
    return value + parts.suffix;
  }

  function buildSitePath(pathname) {
    var parts = splitPathSuffix(pathname);
    var value = ensureLeadingSlash(parts.path);
    if (value === '/') return (siteRootPath ? siteRootPath + '/' : '/') + parts.suffix;
    return (siteRootPath || '') + value + parts.suffix;
  }

  function normalizeSitePath(pathname) {
    return buildSitePath(toSiteRelativePath(pathname));
  }

  function toSiteRelativePath(pathname) {
    var parts = splitPathSuffix(pathname);
    var value = ensureLeadingSlash(parts.path);
    if (siteRootPath && value === siteRootPath) return '/' + parts.suffix;
    if (siteRootPath && value.indexOf(siteRootPath + '/') === 0) {
      return (value.slice(siteRootPath.length) || '/') + parts.suffix;
    }
    return stripDeploymentPrefix(value + parts.suffix);
  }

  function rewriteAttribute(node, name) {
    if (!node || typeof node.getAttribute !== 'function' || typeof node.setAttribute !== 'function') {
      return;
    }

    var value = node.getAttribute(name);
    var parts = splitPathSuffix(value);
    if (!value || (parts.path !== DEPLOYMENT_PREFIX && parts.path.indexOf(DEPLOYMENT_PREFIX + '/') !== 0)) {
      return;
    }

    var normalized = normalizeSitePath(value);
    if (normalized !== value) node.setAttribute(name, normalized);
  }

  function rewriteStaticLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[href]'), function (node) {
      rewriteAttribute(node, 'href');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[src]'), function (node) {
      rewriteAttribute(node, 'src');
    });
  }

  window.KRDSBasePath = {
    deploymentPrefix: DEPLOYMENT_PREFIX,
    siteRootPath: siteRootPath,
    buildSitePath: buildSitePath,
    normalizeSitePath: normalizeSitePath,
    rewriteStaticLinks: rewriteStaticLinks,
    stripDeploymentPrefix: stripDeploymentPrefix,
    toSiteRelativePath: toSiteRelativePath,
  };

  rewriteStaticLinks();
})();
