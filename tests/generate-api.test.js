import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let vercelHandler;
let onRequestPost;

const ALLOWED_ORIGIN = 'http://localhost:3000';
const ROOT = process.cwd();
let originalFetch;
let savedAnthropicApiKey;
let savedAnthropicBaseUrl;
let savedKvUrl;
let savedKvToken;
let defaultRequestIpCounter = 0;

function readSource(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function extractPrompt(relPath, constName) {
  const source = readSource(relPath);
  const match = source.match(new RegExp('const ' + constName + ' = `([\\s\\S]*?)`;'));
  if (!match) throw new Error(`Prompt ${constName} not found in ${relPath}`);
  return match[1];
}

function extractAgencyTypes(relPath) {
  const source = readSource(relPath);
  const match = source.match(/const VALID_AGENCY_TYPES = \[([\s\S]*?)\];/);
  if (!match) throw new Error(`VALID_AGENCY_TYPES not found in ${relPath}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function buildRequest(body, origin, extraHeaders) {
  const providedHeaders = extraHeaders || {};
  const hasExplicitIpHeader = Object.keys(providedHeaders).some((name) => (
    /^(cf-connecting-ip|x-forwarded-for|x-real-ip)$/i.test(name)
  ));

  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin || ALLOWED_ORIGIN,
      ...(hasExplicitIpHeader ? {} : { 'CF-Connecting-IP': buildUniqueTestIp(++defaultRequestIpCounter) }),
      ...providedHeaders,
    },
    body: JSON.stringify(body),
  });
}

function buildRawJsonRequest(rawBody, origin, extraHeaders) {
  const providedHeaders = extraHeaders || {};
  const hasExplicitIpHeader = Object.keys(providedHeaders).some((name) => (
    /^(cf-connecting-ip|x-forwarded-for|x-real-ip)$/i.test(name)
  ));

  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin || ALLOWED_ORIGIN,
      ...(hasExplicitIpHeader ? {} : { 'CF-Connecting-IP': buildUniqueTestIp(++defaultRequestIpCounter) }),
      ...providedHeaders,
    },
    body: rawBody,
  });
}

function mockAnthropicFetch() {
  return vi.fn(async () => {
    return new Response('data: {"type":"message_stop"}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  });
}

async function importFreshModule(relPath) {
  const moduleUrl = pathToFileURL(path.join(ROOT, relPath)).href;
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

function buildUniqueTestIp(index) {
  const second = Math.floor(index / 65536) % 256;
  const third = Math.floor(index / 256) % 256;
  const fourth = index % 256;
  return `198.${second}.${third}.${fourth}`;
}

beforeAll(async () => {
  ({ default: vercelHandler } = await import('../api/generate.js'));
  ({ onRequestPost } = await import('../functions/api/generate.js'));
});

beforeEach(() => {
  originalFetch = global.fetch;
  savedAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key';
  savedAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_BASE_URL;
  savedKvUrl = process.env.KV_REST_API_URL;
  savedKvToken = process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (savedAnthropicApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedAnthropicApiKey;
  if (savedAnthropicBaseUrl === undefined) delete process.env.ANTHROPIC_BASE_URL;
  else process.env.ANTHROPIC_BASE_URL = savedAnthropicBaseUrl;
  if (savedKvUrl === undefined) delete process.env.KV_REST_API_URL;
  else process.env.KV_REST_API_URL = savedKvUrl;
  if (savedKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
  else process.env.KV_REST_API_TOKEN = savedKvToken;
  vi.restoreAllMocks();
});

describe('generator API handlers', () => {
  it('keeps generator prompts and agency-type validation aligned across runtimes', () => {
    const sharedPrompt = extractPrompt('api/shared/generate-shared.js', 'KRDS_SYSTEM_PROMPT');
    const localServerPrompt = extractPrompt('server.js', 'SYSTEM_PROMPT');

    expect(localServerPrompt).toBe(sharedPrompt);
    expect(sharedPrompt).toContain('[한국어 작성 원칙]');
    expect(sharedPrompt).toContain('완료 화면의 과도한 칭찬·이모지');

    const sharedTypes = extractAgencyTypes('api/shared/generate-shared.js');
    const localServerTypes = extractAgencyTypes('server.js');

    expect(localServerTypes).toEqual(sharedTypes);
  });

  it('returns CORS headers on Vercel validation errors', async () => {
    const response = await vercelHandler(buildRequest({
      agencyName: '',
      agencyType: '',
      samples: [],
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.json()).toEqual({
      error: '기관명은 1~50자 사이여야 합니다.',
    });
  });

  it('allows localhost:8300 as a Vercel CORS origin for static preview', async () => {
    const response = await vercelHandler(buildRequest({
      agencyName: '',
      agencyType: '',
      samples: [],
    }, 'http://localhost:8300'));

    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8300');
  });

  it('returns CORS headers on Cloudflare validation errors', async () => {
    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '잘못된 유형',
        samples: ['샘플 문구'],
      }),
      env: {},
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.json()).toEqual({
      error: '올바른 기관 유형을 선택해 주세요.',
    });
  });

  it('omits Access-Control-Allow-Origin but still varies on Origin for disallowed deployed origins', async () => {
    const vercelResponse = await vercelHandler(buildRequest(
      { agencyName: '', agencyType: '', samples: [] },
      'https://untrusted.example',
    ));
    const cloudflareResponse = await onRequestPost({
      request: buildRequest(
        { agencyName: '', agencyType: '', samples: [] },
        'https://untrusted.example',
      ),
      env: {},
    });

    expect(vercelResponse.status).toBe(400);
    expect(vercelResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(vercelResponse.headers.get('vary')).toBe('Origin');
    expect(await vercelResponse.json()).toEqual({
      error: '기관명은 1~50자 사이여야 합니다.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(cloudflareResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(cloudflareResponse.headers.get('vary')).toBe('Origin');
    expect(await cloudflareResponse.json()).toEqual({
      error: '기관명은 1~50자 사이여야 합니다.',
    });
  });

  it('rejects non-object JSON bodies instead of crashing in deployed handlers', async () => {
    const vercelResponse = await vercelHandler(buildRawJsonRequest('null'));
    const cloudflareResponse = await onRequestPost({
      request: buildRawJsonRequest('null'),
      env: {},
    });

    expect(vercelResponse.status).toBe(400);
    expect(vercelResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await vercelResponse.json()).toEqual({
      error: '요청 형식이 올바르지 않습니다.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(cloudflareResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await cloudflareResponse.json()).toEqual({
      error: '요청 형식이 올바르지 않습니다.',
    });
  });

  it('rejects requests that exceed the UI sample-count contract in deployed handlers', async () => {
    const payload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['첫 번째', '두 번째', '세 번째', '네 번째'],
    };

    const vercelResponse = await vercelHandler(buildRequest(payload));
    const cloudflareResponse = await onRequestPost({
      request: buildRequest(payload),
      env: {},
    });

    expect(vercelResponse.status).toBe(400);
    expect(vercelResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await vercelResponse.json()).toEqual({
      error: '샘플 텍스트는 최대 3개까지 입력할 수 있습니다.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(cloudflareResponse.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await cloudflareResponse.json()).toEqual({
      error: '샘플 텍스트는 최대 3개까지 입력할 수 있습니다.',
    });
  });

  it('fails fast with 503 on Vercel when the Anthropic API key is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest(
      {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
      ALLOWED_ORIGIN,
      { 'CF-Connecting-IP': '203.0.113.31' },
    ));

    expect(response.status).toBe(503);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.json()).toEqual({
      error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails fast with 503 on Cloudflare when the Anthropic API key is missing', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const response = await onRequestPost({
      request: buildRequest(
        {
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        },
        ALLOWED_ORIGIN,
        { 'CF-Connecting-IP': '203.0.113.32' },
      ),
      env: {},
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.json()).toEqual({
      error: 'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a local fallback key on Vercel when the loopback gateway base URL is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_BASE_URL = 'http://localhost:8200/krds';
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8200/krds/v1/messages');
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('local-llm');
  });

  it('uses a local fallback key on Cloudflare when the loopback gateway base URL is configured', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: {
        ANTHROPIC_BASE_URL: 'http://localhost:8200/krds',
      },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8200/krds/v1/messages');
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('local-llm');
  });

  it('accepts generator form agency types in the Vercel handler', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.text()).toContain('"type":"done"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes derivative-guide mode context through to the Anthropic request on Vercel', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest({
      mode: 'derivative-guide',
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      screenType: '에러/경고',
      taskBrief: '로그인과 신청 흐름을 우선 반영해 주세요.',
      samples: ['샘플 문구'],
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.max_tokens).toBe(2800);
    expect(requestBody.messages[0].content).toContain('[작업 모드] Layer 3 파생 가이드 초안');
    expect(requestBody.messages[0].content).toContain('화면 맥락: 에러/경고');
    expect(requestBody.messages[0].content).toContain('추가 요청: 로그인과 신청 흐름을 우선 반영해 주세요.');
  });

  it('uses a custom Anthropic base URL in the Vercel handler when configured', async () => {
    process.env.ANTHROPIC_BASE_URL = 'https://proxy.internal/v1/messages?token=a=b';
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.internal/v1/messages?token=a=b');
  });

  it('accepts generator form agency types in the Cloudflare handler', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(await response.text()).toContain('"type":"done"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid generator modes in deployed handlers', async () => {
    const vercelResponse = await vercelHandler(buildRequest({
      mode: 'not-a-real-mode',
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));

    const cloudflareResponse = await onRequestPost({
      request: buildRequest({
        mode: 'not-a-real-mode',
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({
      error: '올바른 작업 모드를 선택해 주세요.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({
      error: '올바른 작업 모드를 선택해 주세요.',
    });
  });

  it('rejects overlong optional fields and non-string optional fields in deployed handlers', async () => {
    const basePayload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    };

    const longScreenType = 'a'.repeat(41);
    const longToneTarget = 'b'.repeat(41);
    const longTaskBrief  = 'c'.repeat(301);

    const screenTypeOverlong = await vercelHandler(buildRequest({ ...basePayload, screenType: longScreenType }));
    expect(screenTypeOverlong.status).toBe(400);
    expect(await screenTypeOverlong.json()).toEqual({ error: '화면 맥락 값을 확인해 주세요.' });

    const toneTargetOverlong = await vercelHandler(buildRequest({ ...basePayload, toneTarget: longToneTarget }));
    expect(toneTargetOverlong.status).toBe(400);
    expect(await toneTargetOverlong.json()).toEqual({ error: '목표 톤 값을 확인해 주세요.' });

    const taskBriefOverlong = await vercelHandler(buildRequest({ ...basePayload, taskBrief: longTaskBrief }));
    expect(taskBriefOverlong.status).toBe(400);
    expect(await taskBriefOverlong.json()).toEqual({ error: '추가 요청은 300자 이하여야 합니다.' });

    const screenTypeNonString = await vercelHandler(buildRequest({ ...basePayload, screenType: 42 }));
    expect(screenTypeNonString.status).toBe(400);
    expect(await screenTypeNonString.json()).toEqual({ error: '화면 맥락 값을 확인해 주세요.' });

    const cfScreenTypeOverlong = await onRequestPost({
      request: buildRequest({ ...basePayload, screenType: longScreenType }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    expect(cfScreenTypeOverlong.status).toBe(400);
    expect(await cfScreenTypeOverlong.json()).toEqual({ error: '화면 맥락 값을 확인해 주세요.' });

    const cfToneTargetOverlong = await onRequestPost({
      request: buildRequest({ ...basePayload, toneTarget: longToneTarget }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    expect(cfToneTargetOverlong.status).toBe(400);
    expect(await cfToneTargetOverlong.json()).toEqual({ error: '목표 톤 값을 확인해 주세요.' });
  });

  it('uses a custom Anthropic base URL in the Cloudflare handler when configured', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        ANTHROPIC_BASE_URL: 'https://proxy.internal/custom',
      },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.internal/custom/v1/messages');
  });

  it('rate-limits Vercel requests by the first forwarded client IP, not the last proxy hop', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    for (let i = 0; i < 5; i += 1) {
      const response = await vercelHandler(buildRequest(
        {
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        },
        ALLOWED_ORIGIN,
        {
          'X-Forwarded-For': `198.51.100.77, 10.0.0.${i + 1}`,
        },
      ));

      expect(response.status).toBe(200);
    }

    const blocked = await vercelHandler(buildRequest(
      {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
      ALLOWED_ORIGIN,
      {
        'X-Forwarded-For': '198.51.100.77, 10.0.0.99',
      },
    ));

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.',
    });
  });

  it('rate-limits Cloudflare requests by the first forwarded client IP, not the last proxy hop', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    for (let i = 0; i < 5; i += 1) {
      const response = await onRequestPost({
        request: buildRequest(
          {
            agencyName: '테스트 기관',
            agencyType: '지방자치단체',
            samples: ['샘플 문구'],
          },
          ALLOWED_ORIGIN,
          {
            'X-Forwarded-For': `198.51.100.88, 10.0.1.${i + 1}`,
          },
        ),
        env: { ANTHROPIC_API_KEY: 'test-key' },
      });

      expect(response.status).toBe(200);
    }

    const blocked = await onRequestPost({
      request: buildRequest(
        {
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        },
        ALLOWED_ORIGIN,
        {
          'X-Forwarded-For': '198.51.100.88, 10.0.1.99',
        },
      ),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.',
    });
  });

  it('ignores blank higher-priority Vercel IP headers and falls back to the forwarded client IP', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    for (let i = 0; i < 5; i += 1) {
      const response = await vercelHandler(buildRequest(
        {
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        },
        ALLOWED_ORIGIN,
        {
          'CF-Connecting-IP': '   ',
          'X-Real-IP': '   ',
          'X-Forwarded-For': `198.51.100.150, 10.0.2.${i + 1}`,
        },
      ));

      expect(response.status).toBe(200);
    }

    const otherClient = await vercelHandler(buildRequest(
      {
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      },
      ALLOWED_ORIGIN,
      {
        'CF-Connecting-IP': '   ',
        'X-Real-IP': '   ',
        'X-Forwarded-For': '198.51.100.151, 10.0.2.99',
      },
    ));

    expect(otherClient.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('ignores blank higher-priority Cloudflare IP headers and falls back to the forwarded client IP', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    for (let i = 0; i < 5; i += 1) {
      const response = await onRequestPost({
        request: buildRequest(
          {
            agencyName: '테스트 기관',
            agencyType: '지방자치단체',
            samples: ['샘플 문구'],
          },
          ALLOWED_ORIGIN,
          {
            'CF-Connecting-IP': '   ',
            'X-Real-IP': '   ',
            'X-Forwarded-For': `198.51.100.160, 10.0.3.${i + 1}`,
          },
        ),
        env: { ANTHROPIC_API_KEY: 'test-key' },
      });

      expect(response.status).toBe(200);
    }

    const otherClient = await onRequestPost({
      request: buildRequest(
        {
          agencyName: '테스트 기관',
          agencyType: '지방자치단체',
          samples: ['샘플 문구'],
        },
        ALLOWED_ORIGIN,
        {
          'CF-Connecting-IP': '   ',
          'X-Real-IP': '   ',
          'X-Forwarded-For': '198.51.100.161, 10.0.3.99',
        },
      ),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(otherClient.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rate-limits by the X-Real-IP header when CF-Connecting-IP is absent', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const basePayload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
        'X-Real-IP': '198.51.100.33',
      }));
      expect(response.status).toBe(200);
    }

    const blocked = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
      'X-Real-IP': '198.51.100.33',
    }));
    expect(blocked.status).toBe(429);
  });

  it('treats all requests without any IP header as sharing the "unknown" rate-limit bucket', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const basePayload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
        'CF-Connecting-IP': '',
        'X-Real-IP': '',
        'X-Forwarded-For': '',
      }));
      expect(response.status).toBe(200);
    }

    const blocked = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
      'CF-Connecting-IP': '',
      'X-Real-IP': '',
      'X-Forwarded-For': '',
    }));
    expect(blocked.status).toBe(429);
  });

  it('flushes a final buffered text chunk even when the upstream stream ends without a trailing newline', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"# 테스트 기관 가이드"}}',
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('# 테스트 기관 가이드');
    expect(body).toContain('"type":"done"');
  });

  it('accepts upstream SSE data lines without a space after the colon in deployed handlers', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data:{"type":"content_block_delta","delta":{"type":"text_delta","text":"# 테스트 기관 가이드"}}\n\n' +
      'data:{"type":"message_stop"}\n\n',
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    ));

    const vercelResponse = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const vercelBody = await vercelResponse.text();

    const cloudflareResponse = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    const cloudflareBody = await cloudflareResponse.text();

    expect(vercelResponse.status).toBe(200);
    expect(vercelBody).toContain('"type":"chunk"');
    expect(vercelBody).toContain('# 테스트 기관 가이드');
    expect(vercelBody).toContain('"type":"done"');

    expect(cloudflareResponse.status).toBe(200);
    expect(cloudflareBody).toContain('"type":"chunk"');
    expect(cloudflareBody).toContain('# 테스트 기관 가이드');
    expect(cloudflareBody).toContain('"type":"done"');
  });

  it('treats a 200 response without usable SSE events as an error in the Vercel handler', async () => {
    global.fetch = vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).not.toContain('"type":"done"');
  });

  it('treats a 200 response without usable SSE events as an error in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => new Response('{"ok":true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).not.toContain('"type":"done"');
  });

  it('keeps the Vercel in-memory rate-limit map fail-closed when the tracking map is saturated', async () => {
    const { default: freshVercelHandler } = await importFreshModule('api/generate.js');

    for (let i = 0; i < 1000; i += 1) {
      const response = await freshVercelHandler(buildRequest(
        { agencyName: '', agencyType: '', samples: [] },
        ALLOWED_ORIGIN,
        { 'CF-Connecting-IP': buildUniqueTestIp(i + 1) },
      ));
      expect(response.status).toBe(400);
    }

    const saturated = await freshVercelHandler(buildRequest(
      { agencyName: '', agencyType: '', samples: [] },
      ALLOWED_ORIGIN,
      { 'CF-Connecting-IP': buildUniqueTestIp(2001) },
    ));

    expect(saturated.status).toBe(429);
    expect(await saturated.json()).toEqual({
      error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.',
    });
  });

  it('keeps the Cloudflare in-memory rate-limit map fail-closed when the tracking map is saturated', async () => {
    const { onRequestPost: freshOnRequestPost } = await importFreshModule('functions/api/generate.js');

    for (let i = 0; i < 1000; i += 1) {
      const response = await freshOnRequestPost({
        request: buildRequest(
          { agencyName: '', agencyType: '', samples: [] },
          ALLOWED_ORIGIN,
          { 'CF-Connecting-IP': buildUniqueTestIp(i + 5000) },
        ),
        env: {},
      });
      expect(response.status).toBe(400);
    }

    const saturated = await freshOnRequestPost({
      request: buildRequest(
        { agencyName: '', agencyType: '', samples: [] },
        ALLOWED_ORIGIN,
        { 'CF-Connecting-IP': buildUniqueTestIp(8000) },
      ),
      env: {},
    });

    expect(saturated.status).toBe(429);
    expect(await saturated.json()).toEqual({
      error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.',
    });
  });

  it('attaches an AbortSignal to the Anthropic fetch in the Vercel handler to prevent hanging requests', async () => {
    let capturedOptions;
    const mockFetch = vi.fn(async (url, options) => {
      capturedOptions = options;
      return {
        ok: false,
        status: 529,
        text: async () => 'overloaded',
        body: null,
      };
    });
    global.fetch = mockFetch;

    const response = await vercelHandler(
      buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'rewrite',
        samples: ['문장 하나'],
      })
    );
    expect(response.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(capturedOptions?.signal).toBeDefined();
    expect(capturedOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('attaches an AbortSignal to the Anthropic fetch in the Cloudflare handler to prevent hanging requests', async () => {
    let capturedOptions;
    const mockFetch = vi.fn(async (url, options) => {
      capturedOptions = options;
      return {
        ok: false,
        status: 529,
        text: async () => 'overloaded',
        body: null,
      };
    });
    global.fetch = mockFetch;

    const response = await onRequestPost({
      request: buildRequest({
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        mode: 'rewrite',
        samples: ['문장 하나'],
      }),
      env: {
        ANTHROPIC_API_KEY: 'test-key',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      },
    });
    expect(response.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(capturedOptions?.signal).toBeDefined();
    expect(capturedOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses Vercel KV to track rate limits and sets TTL on the first request', async () => {
    const kvUrl = 'https://kv.example.com';
    process.env.KV_REST_API_URL = kvUrl;
    process.env.KV_REST_API_TOKEN = 'kv-token';

    let kvIncrCalled = false;
    let kvExpireCalled = false;

    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/incr/')) {
        kvIncrCalled = true;
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      if (u.includes('/expire/')) {
        kvExpireCalled = true;
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      return new Response('data: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      mode: 'rewrite',
      samples: ['문장 하나'],
    }));

    expect(response.status).toBe(200);
    expect(kvIncrCalled).toBe(true);
    expect(kvExpireCalled).toBe(true);
  });

  it('rejects a Vercel request when the KV counter exceeds the rate limit', async () => {
    const kvUrl = 'https://kv.example.com';
    process.env.KV_REST_API_URL = kvUrl;
    process.env.KV_REST_API_TOKEN = 'kv-token';

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/incr/')) {
        return new Response(JSON.stringify({ result: 6 }), { status: 200 }); // > RATE_LIMIT_MAX (5)
      }
      return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    });

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      mode: 'rewrite',
      samples: ['문장 하나'],
    }));

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toMatch(/1시간/);
  });

  it('falls back to in-memory rate limiting when the KV fetch throws on Vercel', async () => {
    const kvUrl = 'https://kv.example.com';
    process.env.KV_REST_API_URL = kvUrl;
    process.env.KV_REST_API_TOKEN = 'kv-token';

    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/incr/') || String(url).includes('/expire/')) {
        throw new Error('KV network error');
      }
      return new Response('data: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      mode: 'rewrite',
      samples: ['문장 하나'],
    }));

    expect(response.status).toBe(200);
  });
});
