import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventEmitter from 'node:events';
import https from 'node:https';
import { createRequire } from 'node:module';
import serverModule from '../server.js';
import { default as vercelHandler } from '../api/generate.js';

const {
  ALLOWED_ORIGINS,
  SITE_BASE_PATH,
  VALID_AGENCY_TYPES,
  buildApiEndpoint,
  getClientIp,
  getRequestHeader,
  isWithinRoot,
  isPublicStaticPath,
  normalizeStaticPath,
  parseEnvValue,
  resolveStaticFilePath,
  server,
} = serverModule;

const DEFAULT_ANTHROPIC_API_KEY = 'test-key';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const savedAllowInsecureTls = process.env.ALLOW_INSECURE_TLS;
const savedAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
const savedAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
const savedOllamaUrl = process.env.OLLAMA_URL;
const requireModule = createRequire(import.meta.url);

beforeEach(() => {
  delete process.env.ALLOW_INSECURE_TLS;
  process.env.ANTHROPIC_API_KEY = DEFAULT_ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_BASE_URL = DEFAULT_ANTHROPIC_BASE_URL;
  delete process.env.OLLAMA_URL;
});

afterEach(() => {
  if (savedAllowInsecureTls === undefined) delete process.env.ALLOW_INSECURE_TLS;
  else process.env.ALLOW_INSECURE_TLS = savedAllowInsecureTls;
  if (savedAnthropicApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedAnthropicApiKey;
  if (savedAnthropicBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
  else process.env.ANTHROPIC_BASE_URL = savedAnthropicBaseUrl;
  if (savedOllamaUrl === undefined) delete process.env.OLLAMA_URL;
  else process.env.OLLAMA_URL = savedOllamaUrl;
});

async function runServerRequest(options = {}) {
  const responseState = { statusCode: null, headers: {}, body: '' };
  const targetServer = options.serverInstance || server;
  const req = new EventEmitter();
  req.url = options.url || '/api/generate';
  req.method = options.method || 'POST';
  req.headers = {
    ...(options.headers || {}),
  };
  req.socket = { remoteAddress: options.remoteAddress || '127.0.0.1' };

  const done = new Promise((resolve) => {
    const res = {
      setHeader(name, value) {
        responseState.headers[String(name).toLowerCase()] = String(value);
      },
      writeHead(statusCode, headers) {
        responseState.statusCode = statusCode;
        Object.entries(headers || {}).forEach(([name, value]) => {
          responseState.headers[String(name).toLowerCase()] = String(value);
        });
      },
      write(chunk) {
        responseState.body += String(chunk || '');
      },
      end(chunk) {
        responseState.body += String(chunk || '');
        resolve();
      },
    };

    targetServer.emit('request', req, res);
  });

  if (Array.isArray(options.bodyChunks)) {
    options.bodyChunks.forEach((chunk) => {
      req.emit('data', chunk);
    });
  } else if (options.body !== undefined) {
    req.emit('data', Buffer.from(typeof options.body === 'string' ? options.body : JSON.stringify(options.body)));
  }
  req.emit('end');

  await done;
  return responseState;
}

function buildUniqueTestIp(index) {
  const second = Math.floor(index / 65536) % 256;
  const third = Math.floor(index / 256) % 256;
  const fourth = index % 256;
  return `198.${second}.${third}.${fourth}`;
}

function loadFreshServerModule() {
  const resolved = requireModule.resolve('../server.js');
  delete requireModule.cache[resolved];
  return requireModule(resolved);
}

function callFreshClaudeStream(body, onChunk, onDone, onError) {
  return loadFreshServerModule().callClaudeStream(body, onChunk, onDone, onError);
}

describe('server.js configuration', () => {
  it('normalizes Anthropic API endpoints without duplicating /v1', () => {
    expect(buildApiEndpoint('https://api.anthropic.com/v1')).toBe('https://api.anthropic.com/v1/messages');
    expect(buildApiEndpoint('https://api.anthropic.com/v1/')).toBe('https://api.anthropic.com/v1/messages');
    expect(buildApiEndpoint('https://api.anthropic.com')).toBe('https://api.anthropic.com/v1/messages');
    expect(buildApiEndpoint('https://proxy.internal/v1/messages')).toBe('https://proxy.internal/v1/messages');
    expect(buildApiEndpoint('https://proxy.internal/v1/messages?token=a=b')).toBe(
      'https://proxy.internal/v1/messages?token=a=b',
    );
    expect(buildApiEndpoint('https://proxy.internal/custom')).toBe('https://proxy.internal/custom/v1/messages');
    expect(buildApiEndpoint('http://localhost:8200/krds')).toBe('http://localhost:8200/krds/v1/messages');
    expect(loadFreshServerModule().API_ENDPOINT).toBe(
      buildApiEndpoint(process.env.ANTHROPIC_BASE_URL || DEFAULT_ANTHROPIC_BASE_URL),
    );
  });

  it('falls back to the Anthropic default endpoint when buildApiEndpoint receives an invalid URL', () => {
    expect(buildApiEndpoint('not a url')).toBe('https://api.anthropic.com/v1/messages');
    expect(buildApiEndpoint(null)).toBe('https://api.anthropic.com/v1/messages');
    expect(buildApiEndpoint('')).toBe('https://api.anthropic.com/v1/messages');
  });

  it('parses quoted dotenv values without keeping wrapper quotes', () => {
    expect(parseEnvValue('"test-key"')).toBe('test-key');
    expect(parseEnvValue("'https://proxy.internal/v1/messages?token=a=b'")).toBe(
      'https://proxy.internal/v1/messages?token=a=b',
    );
    expect(parseEnvValue('  bare-value  ')).toBe('bare-value');
  });

  it('returns an empty string for empty or mismatched-quote dotenv values', () => {
    expect(parseEnvValue('')).toBe('');
    expect(parseEnvValue('"half-quoted')).toBe('"half-quoted');
    expect(parseEnvValue("'half-quoted")).toBe("'half-quoted");
  });

  it('falls back to a local gateway key when KRDS points at the loopback LLangs proxy', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8200/krds';
    process.env.ANTHROPIC_API_KEY = '';
    expect(loadFreshServerModule().getAnthropicApiKey()).toBe('local-llm');

    process.env.ANTHROPIC_BASE_URL = 'https://proxy.internal/custom';
    expect(loadFreshServerModule().getAnthropicApiKey()).toBe('');
  });

  it('recognises 127.0.0.1 as a loopback host and returns local-llm when the API key is empty', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:8200/krds';
    process.env.ANTHROPIC_API_KEY = '';
    expect(loadFreshServerModule().getAnthropicApiKey()).toBe('local-llm');
  });

  it('reads the module-level API_KEY constant when ANTHROPIC_API_KEY is absent from process.env at call time', () => {
    process.env.ANTHROPIC_API_KEY = 'module-load-time-key';
    const mod = loadFreshServerModule();
    delete process.env.ANTHROPIC_API_KEY;
    expect(mod.getAnthropicApiKey()).toBe('module-load-time-key');
  });

  it('reads the module-level BASE_URL constant when ANTHROPIC_BASE_URL is absent from process.env at call time', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8200/krds';
    process.env.ANTHROPIC_API_KEY = '';
    const mod = loadFreshServerModule();
    delete process.env.ANTHROPIC_BASE_URL;
    expect(mod.getAnthropicApiKey()).toBe('local-llm');
  });

  it('does not let the local .env override an explicitly exported Anthropic base URL', () => {
    process.env.ANTHROPIC_BASE_URL = 'https://proxy.internal/custom';

    const freshServerModule = loadFreshServerModule();

    expect(freshServerModule.API_ENDPOINT).toBe('https://proxy.internal/custom/v1/messages');
  });

  it('normalizes local server headers and client IPs the same way as deployed handlers', () => {
    expect(getRequestHeader({
      headers: {
        origin: [' https://thenisaid.github.io ', 'https://ignored.example'],
      },
    }, 'origin')).toBe('https://thenisaid.github.io');

    expect(getClientIp({
      headers: {
        'cf-connecting-ip': '198.51.100.7',
        'x-real-ip': '198.51.100.8',
        'x-forwarded-for': '198.51.100.9, 203.0.113.5',
      },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('198.51.100.7');

    expect(getClientIp({
      headers: {
        'x-real-ip': '198.51.100.8',
        'x-forwarded-for': ['198.51.100.9, 203.0.113.5'],
      },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('198.51.100.8');

    expect(getClientIp({
      headers: {
        'x-forwarded-for': ['198.51.100.9, 203.0.113.5'],
      },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('198.51.100.9');

    expect(getClientIp({
      headers: {},
      socket: { remoteAddress: '10.0.0.5' },
    })).toBe('10.0.0.5');

    expect(getClientIp({ headers: {} })).toBe('unknown');
  });

  it('returns an empty string when a header array contains only blank or non-string entries', () => {
    expect(getRequestHeader({
      headers: { 'x-forwarded-for': ['   ', ''] },
    }, 'x-forwarded-for')).toBe('');

    expect(getClientIp({
      headers: { 'x-forwarded-for': ',' },
      socket: { remoteAddress: '127.0.0.1' },
    })).toBe('127.0.0.1');
  });

  it('accepts the same agency types as the generator UI and deployed handlers', async () => {
    expect(VALID_AGENCY_TYPES).toEqual([
      '지방자치단체',
      '광역자치단체',
      '중앙행정기관',
      '공공기관',
      '교육기관',
      '기타공공기관',
    ]);

    const request = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
    });

    const originalFetch = global.fetch;
    global.fetch = async () => new Response('data: {"type":"message_stop"}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    const response = await vercelHandler(request);
    global.fetch = originalFetch;

    expect(response.status).toBe(200);
  });

  it('keeps local/dev CORS origins aligned with preview workflows', () => {
    expect(ALLOWED_ORIGINS).toEqual([
      'https://thenisaid.github.io',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8300',
      'http://127.0.0.1:8300',
    ]);
  });

  it('rejects non-object JSON bodies in the local server instead of crashing', async () => {
    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: 'null',
    });

    expect(responseState.statusCode).toBe(400);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: '요청 형식이 올바르지 않습니다.',
    });
  });

  it('rejects an array JSON body in the local server', async () => {
    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      remoteAddress: '203.0.113.91',
      body: [1, 2, 3],
    });

    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body)).toEqual({
      error: '요청 형식이 올바르지 않습니다.',
    });
  });

  it('rejects overlong samples in the local server with the same validation message as deployed handlers', async () => {
    const longSample = '가'.repeat(501);
    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: [longSample],
      },
    });

    expect(responseState.statusCode).toBe(400);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: '각 샘플 텍스트는 500자 이하여야 합니다.',
    });
  });

  it('rejects requests that exceed the generator UI sample-count contract in the local server', async () => {
    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['첫 번째', '두 번째', '세 번째', '네 번째'],
      },
    });

    expect(responseState.statusCode).toBe(400);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: '샘플 텍스트는 최대 3개까지 입력할 수 있습니다.',
    });
  });

  it('omits Access-Control-Allow-Origin for disallowed origins in the local server, matching deployed handlers', async () => {
    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'https://untrusted.example',
      },
      body: {
        agencyName: '',
        agencyType: '',
        samples: [],
      },
    });

    expect(responseState.statusCode).toBe(400);
    expect(responseState.headers['access-control-allow-origin']).toBeUndefined();
    expect(responseState.headers.vary).toBe('Origin');
    expect(JSON.parse(responseState.body)).toEqual({
      error: '기관명은 1~50자 사이여야 합니다.',
    });
  });

  it('fails fast with 503 in the local server when the Anthropic API key is missing', async () => {
    process.env.ANTHROPIC_API_KEY = '';

    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-forwarded-for': '203.0.113.40',
      },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
    });

    expect(responseState.statusCode).toBe(503);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
    });
  });

  it('does not crash when the local server receives array-form forwarded headers from Node', async () => {
    process.env.ANTHROPIC_API_KEY = '';

    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-forwarded-for': ['203.0.113.41, 198.51.100.22'],
      },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
    });

    expect(responseState.statusCode).toBe(503);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
    });
  });

  it('preserves multibyte JSON request bodies when a Node data chunk splits inside a UTF-8 code point', async () => {
    process.env.ANTHROPIC_API_KEY = '';

    const body = JSON.stringify({
      agencyName: '테스트 기관',
      agencyType: '공공기관',
      samples: ['샘플 문구'],
    });
    const splitTargetIndex = body.indexOf('공공기관');
    const splitIndex = Buffer.byteLength(body.slice(0, splitTargetIndex)) + 1;
    const encoded = Buffer.from(body, 'utf8');

    const responseState = await runServerRequest({
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-forwarded-for': '203.0.113.42',
      },
      bodyChunks: [
        encoded.slice(0, splitIndex),
        encoded.slice(splitIndex),
      ],
    });

    expect(responseState.statusCode).toBe(503);
    expect(responseState.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(responseState.body)).toEqual({
      error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
    });
  });

  it('serves the same static files under the deployment prefix and directory URLs', () => {
    expect(SITE_BASE_PATH).toBe('/krds-ux-writing');
    expect(normalizeStaticPath('/')).toBe('/index.html');
    expect(normalizeStaticPath('/principles')).toBe('/principles/index.html');
    expect(normalizeStaticPath('/principles/foundation/')).toBe('/principles/foundation/index.html');
    expect(normalizeStaticPath('/corpus/')).toBe('/corpus/index.html');
    expect(normalizeStaticPath('/krds-ux-writing')).toBe('/index.html');
    expect(normalizeStaticPath('/krds-ux-writing/')).toBe('/index.html');
    expect(normalizeStaticPath('/krds-ux-writing/principles/foundation/')).toBe('/principles/foundation/index.html');
    expect(normalizeStaticPath('/krds-ux-writing/archive.html')).toBe('/archive.html');
    expect(normalizeStaticPath('/shared/../server.js')).toBe('/server.js');
    expect(normalizeStaticPath('/generator')).toBe('/generator/index.html');
    expect(normalizeStaticPath('/generator/')).toBe('/generator/index.html');
  });

  it('prepends a leading slash when normalizeStaticPath receives a path without one', () => {
    expect(normalizeStaticPath('principles/')).toBe('/principles/index.html');
    expect(normalizeStaticPath('archive.html')).toBe('/archive.html');
  });

  it('returns true when the candidate path is exactly the root directory itself', () => {
    const dir = process.cwd();
    expect(isWithinRoot(dir, dir)).toBe(true);
  });

  it('canonicalizes traversal-looking static paths without letting them into the public allowlist', () => {
    const safePath = resolveStaticFilePath('/principles/foundation/');
    const escapedSibling = resolveStaticFilePath('/../KRDS-evil');
    const escapedParent = resolveStaticFilePath('/../../etc/passwd');

    expect(isWithinRoot(process.cwd(), safePath)).toBe(true);
    expect(isWithinRoot(process.cwd(), escapedSibling)).toBe(true);
    expect(isWithinRoot(process.cwd(), escapedParent)).toBe(true);
    expect(isPublicStaticPath('/../KRDS-evil')).toBe(false);
    expect(isPublicStaticPath('/../../etc/passwd')).toBe(false);
    expect(isPublicStaticPath('/shared/../server.js')).toBe(false);
    expect(isPublicStaticPath('/corpus/')).toBe(true);
    expect(isPublicStaticPath('/research/public-service-corpus.md')).toBe(true);
    expect(isPublicStaticPath('/jargon-dictionary.json')).toBe(true);
  });

  it('serves public site assets but does not expose internal source files over the local static server', async () => {
    const publicAsset = await runServerRequest({
      method: 'GET',
      url: '/archive.js',
    });
    const internalSource = await runServerRequest({
      method: 'GET',
      url: '/server.js',
    });
    const testSource = await runServerRequest({
      method: 'GET',
      url: '/tests/server-config.test.js',
    });
    const traversedInternalSource = await runServerRequest({
      method: 'GET',
      url: '/shared/../server.js',
    });
    const traversedTestSource = await runServerRequest({
      method: 'GET',
      url: '/shared/../tests/server-config.test.js',
    });

    expect(publicAsset.statusCode).toBe(200);
    expect(publicAsset.headers['content-type']).toBe('application/javascript');
    expect(publicAsset.body).toContain('parseDerivedGuide');

    expect(internalSource.statusCode).toBe(404);
    expect(internalSource.body).toBe('Not Found');

    expect(testSource.statusCode).toBe(404);
    expect(testSource.body).toBe('Not Found');

    expect(traversedInternalSource.statusCode).toBe(404);
    expect(traversedInternalSource.body).toBe('Not Found');

    expect(traversedTestSource.statusCode).toBe(404);
    expect(traversedTestSource.body).toBe('Not Found');
  });

  it('returns 404 when a public-path URL resolves to a file that does not exist on disk', async () => {
    const responseState = await runServerRequest({
      method: 'GET',
      url: '/corpus/does-not-exist-at-all.json',
    });
    expect(responseState.statusCode).toBe(404);
    expect(responseState.body).toBe('Not Found');
  });

  it('treats upstream non-SSE HTTP failures as errors instead of synthetic completion', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        let doneCalled = false;

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 401;
            res.headers = { 'content-type': 'application/json' };
            callback(res);
            res.emit('data', Buffer.from('{"error":"unauthorized"}'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => { doneCalled = true; },
          (message) => {
            expect(doneCalled).toBe(false);
            expect(message).toBe('AI 서비스 연결에 실패했습니다.');
            resolve();
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('keeps TLS certificate verification enabled by default for upstream HTTPS calls', async () => {
    delete process.env.ALLOW_INSECURE_TLS;

    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        https.request = function (options, callback) {
          expect(options.rejectUnauthorized).toBe(true);
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"message_stop"}\n\n'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => resolve(),
          (message) => {
            throw new Error('unexpected error: ' + message);
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('allows opting into insecure TLS only when explicitly requested for internal proxies', async () => {
    process.env.ALLOW_INSECURE_TLS = 'true';

    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        https.request = function (options, callback) {
          expect(options.rejectUnauthorized).toBe(false);
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"message_stop"}\n\n'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => resolve(),
          (message) => {
            throw new Error('unexpected error: ' + message);
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('uses the plain HTTP transport when ANTHROPIC_BASE_URL is an HTTP URL', async () => {
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8200/v1';
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve, reject) => {
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"message_stop"}\n\n'));
            res.emit('end');
          };
          return req;
        };

        loadFreshServerModule().callClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => resolve(),
          (message) => reject(new Error('unexpected error: ' + message)),
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires the error callback immediately when callClaudeStream is called directly without an API key', () => {
    const mod = loadFreshServerModule();
    process.env.ANTHROPIC_API_KEY = '';
    let errorMessage;
    mod.callClaudeStream(
      { model: 'claude-sonnet-4-6' },
      () => {},
      () => {},
      (msg) => { errorMessage = msg; },
    );
    expect(errorMessage).toContain('AI 서비스 구성이 완료되지 않았습니다');
  });

  it('flushes a final buffered Claude chunk without a trailing newline in the local server path', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"# 테스트 기관 가이드"}}',
            ));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['# 테스트 기관 가이드']);
            resolve();
          },
          (message) => {
            throw new Error('unexpected error: ' + message);
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('preserves multibyte UTF-8 characters when an upstream SSE chunk splits inside a code point', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        const prefix = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"';
        const suffix = '"}}\n\ndata: {"type":"message_stop"}\n\n';
        const encoded = Buffer.from(prefix + '가' + suffix, 'utf8');
        const splitIndex = Buffer.byteLength(prefix) + 1;

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', encoded.slice(0, splitIndex));
            res.emit('data', encoded.slice(splitIndex));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['가']);
            resolve();
          },
          (message) => {
            throw new Error('unexpected error: ' + message);
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('accepts upstream SSE data lines without a space after the colon in the local server path', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from(
              'data:{"type":"content_block_delta","delta":{"type":"text_delta","text":"# 테스트 기관 가이드"}}\n\n' +
              'data:{"type":"message_stop"}\n\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['# 테스트 기관 가이드']);
            resolve();
          },
          (message) => {
            throw new Error('unexpected error: ' + message);
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('treats a 200 response without usable SSE events as an error in the local server path', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        let doneCalled = false;

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'application/json' };
            callback(res);
            res.emit('data', Buffer.from('{"ok":true}'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => { doneCalled = true; },
          (message) => {
            expect(doneCalled).toBe(false);
            expect(message).toBe('AI 서비스 연결에 실패했습니다.');
            resolve();
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('keeps the local in-memory rate-limit map fail-closed when the tracking map is saturated', async () => {
    const freshServerModule = loadFreshServerModule();
    const freshServer = freshServerModule.server;

    for (let i = 0; i < 1000; i += 1) {
      const responseState = await runServerRequest({
        serverInstance: freshServer,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'cf-connecting-ip': buildUniqueTestIp(i + 9000),
        },
        body: {
          agencyName: '',
          agencyType: '',
          samples: [],
        },
      });

      expect(responseState.statusCode).toBe(400);
    }

    const saturated = await runServerRequest({
      serverInstance: freshServer,
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'cf-connecting-ip': buildUniqueTestIp(12000),
      },
      body: {
        agencyName: '',
        agencyType: '',
        samples: [],
      },
    });

    expect(saturated.statusCode).toBe(429);
    expect(saturated.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(JSON.parse(saturated.body)).toEqual({
      error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.',
    });
  });

  it('evicts expired entries from the local rate-limit map when the map is full', async () => {
    const freshServerModule = loadFreshServerModule();
    const freshServer = freshServerModule.server;
    const realNow = Date.now();
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
    const pastTime = realNow - RATE_LIMIT_WINDOW_MS - 1000;

    vi.spyOn(Date, 'now').mockReturnValue(pastTime);
    try {
      for (let i = 0; i < 1000; i += 1) {
        await runServerRequest({
          serverInstance: freshServer,
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'cf-connecting-ip': buildUniqueTestIp(i + 30000),
          },
          body: { agencyName: '', agencyType: '', samples: [] },
        });
      }

      vi.spyOn(Date, 'now').mockReturnValue(realNow);

      const response = await runServerRequest({
        serverInstance: freshServer,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'cf-connecting-ip': buildUniqueTestIp(40000),
        },
        body: { agencyName: '', agencyType: '', samples: [] },
      });

      expect(response.statusCode).not.toBe(429);
      expect(response.statusCode).toBe(400);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('calls req.setTimeout with 30 000 ms on Anthropic API requests in the local server', () => {
    const originalRequest = https.request;
    try {
      let capturedTimeout;

      https.request = function (options, callback) {
        const req = new EventEmitter();
        req.write = function () {};
        req.end = function () {};
        req.destroy = function () {};
        req.setTimeout = function (ms) { capturedTimeout = ms; };
        return req;
      };

      callFreshClaudeStream(
        { model: 'claude-sonnet-4-6' },
        () => {},
        () => {},
        () => {},
      );

      expect(capturedTimeout).toBe(30000);
    } finally {
      https.request = originalRequest;
    }
  });

  it('reports a timeout error when the Anthropic API socket stalls and destroys the request', async () => {
    const originalRequest = https.request;
    try {
      let timeoutCallback;
      let reqDestroyed = false;
      let errorMessage;

      await new Promise((resolve) => {
        https.request = function (options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {};
          req.destroy = function () { reqDestroyed = true; };
          req.setTimeout = function (ms, cb) { timeoutCallback = cb; };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => {},
          (message) => {
            errorMessage = message;
            resolve();
          },
        );

        // Simulate socket timeout firing
        setTimeout(() => { if (timeoutCallback) timeoutCallback(); }, 0);
      });

      expect(reqDestroyed).toBe(true);
      expect(errorMessage).toMatch(/초과/);
    } finally {
      https.request = originalRequest;
    }
  });

  it('calls req.setTimeout with 120 000 ms on Ollama API requests in the local server', () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    let capturedTimeout;
    try {
      http.request = function (options, callback) {
        const req = new EventEmitter();
        req.write = function () {};
        req.end = function () {};
        req.destroy = function () {};
        req.setTimeout = function (ms) { capturedTimeout = ms; };
        return req;
      };

      callOllama('http://localhost:11434', 'system', 'user message', 2200, () => {}, () => {}, () => {});

      expect(capturedTimeout).toBe(120000);
    } finally {
      http.request = originalRequest;
    }
  });

  it('reports a timeout error when the Ollama socket stalls and destroys the request', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      let timeoutCallback;
      let reqDestroyed = false;
      let errorMessage;

      await new Promise((resolve) => {
        http.request = function (options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.end = function () {};
          req.destroy = function () { reqDestroyed = true; };
          req.setTimeout = function (ms, cb) { timeoutCallback = cb; };
          return req;
        };

        callOllama(
          'http://localhost:11434',
          'system',
          'user message',
          2200,
          () => {},
          () => {},
          (message) => { errorMessage = message; resolve(); },
        );

        setTimeout(() => { if (timeoutCallback) timeoutCallback(); }, 0);
      });

      expect(reqDestroyed).toBe(true);
      expect(errorMessage).toMatch(/초과/);
    } finally {
      http.request = originalRequest;
    }
  });

  it('rejects non-http/https Ollama URL protocols without making a network request', () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    let errorMessage;
    callOllama('file:///etc/passwd', 'system', 'msg', 2200, () => {}, () => {}, (msg) => { errorMessage = msg; });
    expect(errorMessage).toMatch(/형식/);
  });

  it('passes an SSE error event type from Claude as an error in the local server path', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        let doneCalled = false;

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"error","error":{"message":"overloaded"}}\n\n'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => { doneCalled = true; },
          (message) => {
            expect(doneCalled).toBe(false);
            expect(message).toContain('AI 처리 중 오류');
            resolve();
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('reports a network error when the upstream Anthropic request connection fails', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        https.request = function (_options, _callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => {},
          (message) => {
            expect(message).toContain('연결할 수 없습니다');
            resolve();
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('reports a mid-stream error when the Anthropic response socket drops', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            process.nextTick(() => res.emit('error', new Error('socket hang up')));
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => {},
          (message) => {
            expect(message).toContain('끊겼습니다');
            resolve();
          },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('treats a [DONE] SSE sentinel as a no-op in the local Claude server path', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from(
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"내용"}}\n' +
              'data: [DONE]\n' +
              'data: {"type":"message_stop"}\n\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['내용']);
            resolve();
          },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('fires done via the buffer flush path when a message_stop arrives without a trailing newline', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            // content with trailing newline → processed immediately in on('data')
            res.emit('data', Buffer.from('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}\n'));
            // message_stop WITHOUT trailing newline → stays in buffer, flushed on('end')
            res.emit('data', Buffer.from('data: {"type":"message_stop"}'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => resolve(),
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('silently skips a malformed-JSON data: line and still fires done from the next valid message_stop', async () => {
    const originalRequest = https.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];

        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from(
              'data: {not valid json}\n' +
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"텍스트"}}\n' +
              'data: {"type":"message_stop"}\n\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['텍스트']);
            resolve();
          },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('fires the error callback when the upstream SSE stream sends a type:error event in callClaudeStream', async () => {
    const originalRequest = https.request;
    try {
      let errorMessage;
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"error","error":{"type":"overloaded","message":"overloaded"}}\n'));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => { throw new Error('unexpected done'); },
          (msg) => { errorMessage = msg; resolve(); },
        );
      });

      expect(errorMessage).toContain('AI 처리 중');
    } finally {
      https.request = originalRequest;
    }
  });

  it('silently skips unknown Claude SSE event types (e.g. message_start) and still fires done on message_stop', async () => {
    const originalRequest = https.request;
    try {
      const chunks = [];
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from(
              'data: {"type":"message_start","message":{"id":"msg_01","role":"assistant"}}\n' +
              'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n' +
              'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"결과"}}\n' +
              'data: {"type":"content_block_stop","index":0}\n' +
              'data: {"type":"message_stop"}\n\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['결과']); resolve(); },
          (msg) => { throw new Error('unexpected error: ' + msg); },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('handles the OPTIONS preflight on the local server with a 204 and no body', async () => {
    const responseState = await runServerRequest({
      method: 'OPTIONS',
      url: '/api/generate',
      headers: { origin: 'http://localhost:3000' },
    });

    expect(responseState.statusCode).toBe(204);
    expect(responseState.body).toBe('');
  });

  it('streams Ollama ndjson chunks as SSE text and fires done when evt.done is true', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];

        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from(
              '{"model":"test","response":"안녕","done":false}\n' +
              '{"model":"test","response":"하세요","done":false}\n' +
              '{"model":"test","done":true}\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434',
          'system',
          'user message',
          2200,
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['안녕', '하세요']);
            resolve();
          },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('treats an Ollama HTTP 4xx response as an error without calling onDone', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        let doneCalled = false;

        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 404;
            callback(res);
            res.emit('data', Buffer.from('not found'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434',
          'system',
          'user message',
          2200,
          () => {},
          () => { doneCalled = true; },
          (message) => {
            expect(doneCalled).toBe(false);
            expect(message).toContain('로컬 AI 서비스 연결에 실패했습니다');
            resolve();
          },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires done via the end-of-stream buffer flush when the Ollama done:true event has no trailing newline', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from('{"model":"test","response":"내용","done":false}\n'));
            res.emit('data', Buffer.from('{"model":"test","done":true}'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['내용']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('skips blank lines in the Ollama ndjson stream without treating them as errors', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // blank line between two valid ndjson events
            res.emit('data', Buffer.from(
              '{"model":"test","response":"안녕","done":false}\n' +
              '\n' +
              '{"model":"test","done":true}\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['안녕']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('silently skips Ollama ndjson events that have no response field and done is false', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from(
              '{"model":"test","created_at":"2026-01-01T00:00:00Z"}\n' + // no done, no response → fall-through
              '{"model":"test","response":"내용","done":false}\n' +
              '{"model":"test","done":true}\n',
            ));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['내용']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires done via sawContent fallback when Ollama content arrived but no explicit done event was sent', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from('{"model":"test","response":"결과","done":false}\n'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['결과']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('reports the no-content Ollama error when the stream ends with no response or done event', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from('{malformed json}\n'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          () => {},
          () => { throw new Error('unexpected done'); },
          (message) => {
            expect(message).toContain('로컬 AI 서비스 연결에 실패했습니다');
            resolve();
          },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires done after calling onChunk when a content event arrives in the buffer flush without a trailing newline', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // No trailing newline → whole payload stays in buffer until 'end'
            res.emit('data', Buffer.from('{"model":"test","response":"버퍼","done":false}'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['버퍼']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires done when the Ollama done event arrives in the buffer flush without a trailing newline', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // Content line with newline, then done line without newline
            res.emit('data', Buffer.from('{"model":"test","response":"내용","done":false}\n'));
            res.emit('data', Buffer.from('{"model":"test","done":true}'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['내용']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('calls onDone (not onError) when the end-of-stream buffer flush contains malformed JSON but prior content was received', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // Valid chunk with newline → sawContent = true
            res.emit('data', Buffer.from('{"model":"test","response":"선행 내용","done":false}\n'));
            // Malformed JSON without newline → stays in buffer until 'end'
            res.emit('data', Buffer.from('{malformed'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => { expect(chunks).toEqual(['선행 내용']); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires an error when the Ollama response socket emits an error after the connection is established', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            process.nextTick(() => res.emit('error', new Error('socket hang up')));
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          () => {},
          () => { throw new Error('unexpected done'); },
          (message) => {
            expect(message).toContain('연결이 끊겼습니다');
            resolve();
          },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('reports a network error when the Ollama request connection fails', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        http.request = function (_options, _callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
          };
          return req;
        };

        callOllama(
          'http://localhost:11434',
          'system',
          'user message',
          2200,
          () => {},
          () => {},
          (message) => {
            expect(message).toContain('Ollama에 연결할 수 없습니다');
            resolve();
          },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('reports an error immediately when the Ollama URL is completely unparseable', () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    let errorMessage;
    callOllama('::not-a-url-at-all', 'system', 'msg', 2200, () => {}, () => {}, (msg) => { errorMessage = msg; });
    expect(errorMessage).toMatch(/형식/);
  });

  it('reports an error immediately when the Ollama URL uses an unsupported protocol', () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    let errorMessage;
    callOllama('ftp://localhost:11434', 'system', 'msg', 2200, () => {}, () => {}, (msg) => { errorMessage = msg; });
    expect(errorMessage).toMatch(/형식/);
  });

  it('flushes a content chunk from the Ollama end-of-stream buffer when the last line has no trailing newline', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // First chunk ends with \n — processed in on('data')
            res.emit('data', Buffer.from('{"model":"test","response":"첫 번째 내용","done":false}\n'));
            // Second chunk has NO trailing \n — stays in buffer, flushed on('end')
            res.emit('data', Buffer.from('{"model":"test","response":" 두 번째 내용","done":false}'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toContain('첫 번째 내용');
            expect(chunks).toContain(' 두 번째 내용');
            resolve();
          },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('fires done from the Ollama end-of-stream buffer when the last line is a done event without a trailing newline', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      await new Promise((resolve) => {
        const chunks = [];
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            // content line with trailing newline → processed immediately
            res.emit('data', Buffer.from('{"model":"test","response":"내용","done":false}\n'));
            // done event WITHOUT trailing newline → stays in buffer, flushed on('end')
            res.emit('data', Buffer.from('{"model":"test","done":true}'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          (text) => { chunks.push(text); },
          () => {
            expect(chunks).toEqual(['내용']);
            resolve();
          },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      http.request = originalRequest;
    }
  });

  it('uses the https transport module when the Ollama URL scheme is https', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const originalRequest = https.request;
    let httpsUsed = false;
    try {
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          httpsUsed = true;
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from('{"model":"test","response":"안녕","done":false}\n'));
            res.emit('data', Buffer.from('{"model":"test","done":true}\n'));
            res.emit('end');
          };
          return req;
        };

        callOllama(
          'https://ollama.internal:443', 'system', 'user', 2200,
          () => {},
          () => { expect(httpsUsed).toBe(true); resolve(); },
          (message) => { throw new Error('unexpected error: ' + message); },
        );
      });
    } finally {
      https.request = originalRequest;
    }
  });

  it('rejects a local server request when screenType exceeds the 40-character limit', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'guide-draft',
        samples: ['샘플 문구'],
        screenType: '가'.repeat(41),
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('화면 맥락');
  });

  it('rejects a local server request when toneTarget is a non-string value', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.51' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'guide-draft',
        samples: ['샘플 문구'],
        toneTarget: 12345,
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('목표 톤');
  });

  it('rejects a local server request when taskBrief exceeds the 300-character limit', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.52' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'guide-draft',
        samples: ['샘플 문구'],
        taskBrief: '나'.repeat(301),
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('추가 요청');
  });

  it('routes requests arriving on the SITE_BASE_PATH-prefixed URL to the generate handler', async () => {
    const responseState = await runServerRequest({
      url: `${SITE_BASE_PATH}/api/generate`,
      body: { agencyName: '테스트 기관', agencyType: '지방자치단체', samples: [] },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toBeDefined();
  });

  it('rejects a local server request with an invalid agency type', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.53' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '알 수 없는 유형',
        samples: ['샘플 문구'],
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('기관 유형');
  });

  it('rejects a local server request with an invalid generator mode', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.54' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'not-a-valid-mode',
        samples: ['샘플 문구'],
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('작업 모드');
  });

  it('rejects a local server request when agencyName exceeds 50 characters', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.56' },
      body: {
        agencyName: 'a'.repeat(51),
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toContain('기관명은');
  });

  it('accepts a request body emitted as a raw string chunk instead of a Buffer', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const freshServer = loadFreshServerModule().server;

    const responseState = { statusCode: null, headers: {}, body: '' };
    const req = new EventEmitter();
    req.url = '/api/generate';
    req.method = 'POST';
    req.headers = { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.99' };
    req.socket = { remoteAddress: '127.0.0.1' };

    const done = new Promise((resolve) => {
      const res = {
        setHeader() {},
        writeHead(statusCode) { responseState.statusCode = statusCode; },
        end(chunk) { responseState.body += String(chunk || ''); resolve(); },
        write(chunk) { responseState.body += String(chunk || ''); },
      };
      freshServer.emit('request', req, res);
    });

    req.emit('data', JSON.stringify({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: [],
    }));
    req.emit('end');

    await done;
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toBeDefined();
  });

  it('routes generation requests through Ollama when OLLAMA_URL is set in the local server', async () => {
    process.env.OLLAMA_URL = 'http://localhost:11434';
    const http = requireModule('node:http');
    const originalRequest = http.request;
    const freshServerModule = loadFreshServerModule();
    const freshServer = freshServerModule.server;

    try {
      await new Promise((resolve) => {
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            callback(res);
            res.emit('data', Buffer.from('{"model":"test","response":"결과","done":false}\n'));
            res.emit('data', Buffer.from('{"model":"test","done":true}\n'));
            res.emit('end');
          };
          return req;
        };

        const responseState = { statusCode: null, headers: {}, body: '' };
        const req = new EventEmitter();
        req.url = '/api/generate';
        req.method = 'POST';
        req.headers = { 'x-forwarded-for': '203.0.113.55' };
        req.socket = { remoteAddress: '127.0.0.1' };
        const res = {
          setHeader(name, value) { responseState.headers[String(name).toLowerCase()] = String(value); },
          writeHead(code, hdrs) {
            responseState.statusCode = code;
            Object.entries(hdrs || {}).forEach(([k, v]) => { responseState.headers[k.toLowerCase()] = String(v); });
          },
          write(chunk) {
            responseState.body += String(chunk || '');
            if (responseState.body.includes('"done"')) resolve(responseState);
          },
          end(chunk) { responseState.body += String(chunk || ''); },
        };

        freshServer.emit('request', req, res);
        req.emit('data', Buffer.from(JSON.stringify({
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        })));
        req.emit('end');
      });
    } finally {
      http.request = originalRequest;
      delete process.env.OLLAMA_URL;
    }
  });

  it('fires the error callback when a 4xx Claude response socket emits an error event', async () => {
    const originalRequest = https.request;
    try {
      let errorMessage;
      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 401;
            callback(res);
            process.nextTick(() => res.emit('error', new Error('socket reset')));
          };
          return req;
        };

        callFreshClaudeStream(
          { model: 'claude-sonnet-4-6' },
          () => {},
          () => { throw new Error('unexpected done'); },
          (msg) => { errorMessage = msg; resolve(); },
        );
      });

      expect(errorMessage).toContain('끊겼습니다');
    } finally {
      https.request = originalRequest;
    }
  });

  it('fires the error callback when a 4xx Ollama response socket emits an error event', async () => {
    const { callOllamaStream: callOllama } = loadFreshServerModule();
    const http = requireModule('node:http');
    const originalRequest = http.request;
    try {
      let errorMessage;
      await new Promise((resolve) => {
        http.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function () {};
          req.setTimeout = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 503;
            callback(res);
            process.nextTick(() => res.emit('error', new Error('socket reset')));
          };
          return req;
        };

        callOllama(
          'http://localhost:11434', 'system', 'user', 2200,
          () => {},
          () => { throw new Error('unexpected done'); },
          (msg) => { errorMessage = msg; resolve(); },
        );
      });

      expect(errorMessage).toContain('끊겼습니다');
    } finally {
      http.request = originalRequest;
    }
  });

  it('accepts a string body chunk (not a Buffer) when decoding the POST request body', async () => {
    const freshServerModule = loadFreshServerModule();
    const freshServer = freshServerModule.server;

    const responseState = { statusCode: null, body: '' };
    await new Promise((resolve) => {
      const req = new EventEmitter();
      req.url = '/api/generate';
      req.method = 'POST';
      req.headers = { 'x-forwarded-for': '203.0.113.93' };
      req.socket = { remoteAddress: '127.0.0.1' };
      const res = {
        setHeader() {},
        writeHead(code) { responseState.statusCode = code; },
        write() {},
        end(chunk) { responseState.body += String(chunk || ''); resolve(); },
      };

      freshServer.emit('request', req, res);
      // emit body as a plain string instead of a Buffer
      req.emit('data', JSON.stringify({ agencyName: '기관', agencyType: '지방자치단체', samples: [] }));
      req.emit('end');
    });

    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body)).toMatchObject({ error: expect.any(String) });
  });

  it('sends max_tokens=2800 to Claude when the generator mode is derivative-guide', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key-for-derivative-guide';
    const originalRequest = https.request;
    try {
      let capturedBody;

      await new Promise((resolve) => {
        https.request = function (_options, callback) {
          const req = new EventEmitter();
          req.write = function (chunk) { capturedBody = chunk; };
          req.setTimeout = function () {};
          req.destroy = function () {};
          req.end = function () {
            const res = new EventEmitter();
            res.statusCode = 200;
            res.headers = { 'content-type': 'text/event-stream' };
            callback(res);
            res.emit('data', Buffer.from('data: {"type":"message_stop"}\n\n'));
            res.emit('end');
          };
          return req;
        };

        runServerRequest({
          headers: { 'cf-connecting-ip': '203.0.113.99' },
          body: {
            agencyName: '테스트 기관',
            agencyType: '지방자치단체',
            mode: 'derivative-guide',
            samples: ['샘플 문구'],
          },
        }).then(resolve);
      });

      expect(JSON.parse(capturedBody).max_tokens).toBe(2800);
    } finally {
      https.request = originalRequest;
    }
  });

  it('passes optional screenType, toneTarget, and taskBrief through validation and reaches buildUserMessage', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.60' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'tone-adjust',
        samples: ['샘플 문구'],
        screenType: '로그인 화면',
        toneTarget: '친근한 말투',
        taskBrief: '추가적인 설명을 포함해 주세요.',
      },
    });
    expect(responseState.statusCode).toBe(503);
  });

  it('returns local-llm key when ANTHROPIC_BASE_URL uses an IPv6 loopback address with bracket notation', () => {
    process.env.ANTHROPIC_BASE_URL = 'http://[::1]:8200/krds';
    process.env.ANTHROPIC_API_KEY = '';
    expect(loadFreshServerModule().getAnthropicApiKey()).toBe('local-llm');
  });

  it('rejects a local server request when all sample elements are non-string values', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.57' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: [123, null, true],
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toBe('유효한 샘플 텍스트를 1개 이상 입력해 주세요.');
  });

  it('rejects a local server request when all sample strings contain only whitespace', async () => {
    const responseState = await runServerRequest({
      headers: { 'x-forwarded-for': '203.0.113.58' },
      body: {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['   ', '\t'],
      },
    });
    expect(responseState.statusCode).toBe(400);
    expect(JSON.parse(responseState.body).error).toBe('유효한 샘플 텍스트를 1개 이상 입력해 주세요.');
  });

  it('returns 429 when the rate-limit map is full with non-expired entries and a new IP tries to connect', async () => {
    const freshServerModule = loadFreshServerModule();
    const freshServer = freshServerModule.server;
    const pinnedNow = Date.now();

    vi.spyOn(Date, 'now').mockReturnValue(pinnedNow);
    try {
      // Fill the map with 1000 unique non-expired IPs (count=1 each, all valid)
      for (let i = 0; i < 1000; i += 1) {
        await runServerRequest({
          serverInstance: freshServer,
          headers: {
            'content-type': 'application/json',
            origin: 'http://localhost:3000',
            'cf-connecting-ip': buildUniqueTestIp(i + 50000),
          },
          body: { agencyName: '', agencyType: '', samples: [] },
        });
      }

      // A new IP with no entry: map is full with non-expired entries → eviction removes nothing → return false → 429
      const response = await runServerRequest({
        serverInstance: freshServer,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'cf-connecting-ip': buildUniqueTestIp(60000),
        },
        body: { agencyName: '', agencyType: '', samples: [] },
      });

      expect(response.statusCode).toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
