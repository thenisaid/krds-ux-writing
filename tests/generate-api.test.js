import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let vercelHandler;
let onRequestPost;
let onRequestOptions;

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
  ({ onRequestPost, onRequestOptions } = await import('../functions/api/generate.js'));
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

  it('rejects requests where all samples are blank or whitespace-only in deployed handlers', async () => {
    const payload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['   ', ''],
    };

    const vercelResponse = await vercelHandler(buildRequest(payload));
    const cloudflareResponse = await onRequestPost({
      request: buildRequest(payload),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({
      error: '유효한 샘플 텍스트를 1개 이상 입력해 주세요.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({
      error: '유효한 샘플 텍스트를 1개 이상 입력해 주세요.',
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

  it('includes the toneTarget field in the Anthropic request body when it is provided', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      toneTarget: '친근하고 명확한 안내',
      samples: ['샘플 문구'],
    }));

    expect(response.status).toBe(200);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.messages[0].content).toContain('목표 톤: 친근하고 명확한 안내');
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

    const cfTaskBriefOverlong = await onRequestPost({
      request: buildRequest({ ...basePayload, taskBrief: longTaskBrief }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    expect(cfTaskBriefOverlong.status).toBe(400);
    expect(await cfTaskBriefOverlong.json()).toEqual({ error: '추가 요청은 300자 이하여야 합니다.' });
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

  it('rate-limits Cloudflare requests by the X-Real-IP header when CF-Connecting-IP is absent', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const basePayload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await onRequestPost({
        request: buildRequest(basePayload, ALLOWED_ORIGIN, {
          'X-Real-IP': '203.0.113.88',
        }),
        env: { ANTHROPIC_API_KEY: 'test-key' },
      });
      expect(response.status).toBe(200);
    }

    const blocked = await onRequestPost({
      request: buildRequest(basePayload, ALLOWED_ORIGIN, {
        'X-Real-IP': '203.0.113.88',
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });
    expect(blocked.status).toBe(429);
  });

  it('rate-limits requests by the X-Real-IP header when CF-Connecting-IP is absent', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const basePayload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    };

    for (let i = 0; i < 5; i += 1) {
      const response = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
        'X-Real-IP': '203.0.113.77',
      }));
      expect(response.status).toBe(200);
    }

    const blocked = await vercelHandler(buildRequest(basePayload, ALLOWED_ORIGIN, {
      'X-Real-IP': '203.0.113.77',
    }));
    expect(blocked.status).toBe(429);
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

  it('does not call the KV expire endpoint on subsequent requests within the same rate-limit window', async () => {
    const kvUrl = 'https://kv.example.com';
    process.env.KV_REST_API_URL = kvUrl;
    process.env.KV_REST_API_TOKEN = 'kv-token';

    let kvExpireCalled = false;

    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/incr/')) {
        // count=3: subsequent request in same window (> 1, ≤ RATE_LIMIT_MAX=5)
        return new Response(JSON.stringify({ result: 3 }), { status: 200 });
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
    expect(kvExpireCalled).toBe(false);
  });

  it('falls back to in-memory rate limiting when the KV expire endpoint throws on the first request', async () => {
    const kvUrl = 'https://kv.example.com';
    process.env.KV_REST_API_URL = kvUrl;
    process.env.KV_REST_API_TOKEN = 'kv-token';

    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/incr/')) {
        // count=1: first request — triggers /expire/ call
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      if (u.includes('/expire/')) {
        throw new Error('expire endpoint unreachable');
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

  it('rejects all-whitespace samples as having no valid content in deployed handlers', async () => {
    const payload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['   ', '\t', '  \n  '],
    };

    const vercelResponse = await vercelHandler(buildRequest(payload));
    const cloudflareResponse = await onRequestPost({
      request: buildRequest(payload),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({
      error: '유효한 샘플 텍스트를 1개 이상 입력해 주세요.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({
      error: '유효한 샘플 텍스트를 1개 이상 입력해 주세요.',
    });
  });

  it('rejects a sample that exceeds 500 characters in deployed handlers', async () => {
    const payload = {
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['가'.repeat(501)],
    };

    const vercelResponse = await vercelHandler(buildRequest(payload));
    const cloudflareResponse = await onRequestPost({
      request: buildRequest(payload),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({
      error: '각 샘플 텍스트는 500자 이하여야 합니다.',
    });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({
      error: '각 샘플 텍스트는 500자 이하여야 합니다.',
    });
  });

  it('rejects an array JSON body instead of crashing in deployed handlers', async () => {
    const vercelResponse = await vercelHandler(buildRawJsonRequest('[1,2,3]'));
    const cloudflareResponse = await onRequestPost({
      request: buildRawJsonRequest('[1,2,3]'),
      env: {},
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({ error: '요청 형식이 올바르지 않습니다.' });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({ error: '요청 형식이 올바르지 않습니다.' });
  });

  it('returns 204 with CORS headers on Cloudflare preflight OPTIONS requests', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'OPTIONS',
      headers: {
        'Origin': ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });

    const response = await onRequestOptions({ request });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-methods')).toContain('OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('omits Access-Control-Allow-Origin on OPTIONS requests from untrusted origins', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'OPTIONS',
      headers: { 'Origin': 'https://attacker.example' },
    });

    const response = await onRequestOptions({ request });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sends an SSE error event when the upstream Claude API responds with a non-200 status', async () => {
    global.fetch = vi.fn(async () => new Response('Internal Server Error', { status: 500 }));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).toContain('AI 서비스 연결에 실패했습니다');
  });

  it('sends an SSE error event when the upstream Claude SSE stream contains a type:error event', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"error","error":{"type":"overloaded_error","message":"overloaded"}}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).toContain('AI 처리 중 오류');
  });

  it('sends an SSE error event when the fetch itself throws a network-level error', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network failure'); });

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).toContain('AI 서비스에 연결할 수 없습니다');
  });

  it('sends an SSE error event when the readable stream errors mid-transfer', async () => {
    global.fetch = vi.fn(async () => {
      const readable = new ReadableStream({
        start(controller) {
          controller.error(new Error('socket dropped'));
        },
      });
      return new Response(readable, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).toContain('연결이 끊겼습니다');
  });

  it('treats a [DONE] SSE sentinel as a no-op and sends done when content was already streamed', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"안녕"}}\n' +
      'data: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('"type":"done"');
    expect(body).not.toContain('"type":"error"');
  });

  it('returns 204 with CORS headers on Vercel preflight OPTIONS requests', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'OPTIONS',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });
    const response = await vercelHandler(request);
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('returns 405 for non-POST methods in the Vercel handler', async () => {
    const request = new Request('http://localhost/api/generate', {
      method: 'GET',
      headers: {
        Origin: ALLOWED_ORIGIN,
        'CF-Connecting-IP': buildUniqueTestIp(++defaultRequestIpCounter),
      },
    });
    const response = await vercelHandler(request);
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: '허용되지 않는 메서드입니다.' });
  });

  it('rejects a Vercel request when agencyName exceeds 50 characters', async () => {
    const response = await vercelHandler(buildRequest({
      agencyName: 'a'.repeat(51),
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '기관명은 1~50자 사이여야 합니다.' });
  });

  it('silently skips SSE data lines with invalid JSON and continues streaming', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: not-valid-json\n' +
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"결과"}}\n' +
      'data: {"type":"message_stop"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"chunk"');
    expect(body).not.toContain('"type":"error"');
  });

  it('silently skips non-data SSE lines such as event: and comment lines', async () => {
    global.fetch = vi.fn(async () => new Response(
      ': comment line\n' +
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"결과"}}\n' +
      'data: {"type":"message_stop"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"chunk"');
    expect(body).not.toContain('"type":"error"');
  });

  it('rejects a Cloudflare request when agencyName exceeds 50 characters', async () => {
    const response = await onRequestPost({
      request: buildRequest({
        agencyName: 'a'.repeat(51),
        agencyType: '지방자치단체',
        samples: ['샘플 문구'],
      }),
      env: {},
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '기관명은 1~50자 사이여야 합니다.' });
  });

  it('passes derivative-guide mode with max_tokens 2800 through to the Anthropic request in the Cloudflare handler', async () => {
    const fetchMock = mockAnthropicFetch();
    global.fetch = fetchMock;

    const response = await onRequestPost({
      request: buildRequest({
        mode: 'derivative-guide',
        agencyName: '테스트 기관',
        agencyType: '지방자치단체',
        screenType: '서비스 예약',
        samples: ['전시 예약이 완료되었습니다.'],
      }),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.max_tokens).toBe(2800);
    expect(requestBody.messages[0].content).toContain('[작업 모드] Layer 3 파생 가이드 초안');
  });

  it('silently skips SSE data lines with invalid JSON in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: not-valid-json\n' +
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"결과"}}\n' +
      'data: {"type":"message_stop"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

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
    expect(body).toContain('"type":"chunk"');
    expect(body).not.toContain('"type":"error"');
  });

  it('silently skips non-data SSE lines such as event: and comment lines in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => new Response(
      ': comment line\n' +
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"결과"}}\n' +
      'data: {"type":"message_stop"}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

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
    expect(body).toContain('"type":"chunk"');
    expect(body).not.toContain('"type":"error"');
  });

  it('falls back to the unknown IP bucket when X-Forwarded-For is non-empty but all parts are blank in the Vercel handler', async () => {
    const { default: freshVercelHandler } = await importFreshModule('api/generate.js');
    global.fetch = mockAnthropicFetch();

    const response = await freshVercelHandler(buildRequest(
      { agencyName: '테스트 기관', agencyType: '지방자치단체', samples: ['샘플 문구'] },
      ALLOWED_ORIGIN,
      { 'X-Forwarded-For': ',' },
    ));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
  });

  it('falls back to the unknown IP bucket when X-Forwarded-For is non-empty but all parts are blank in the Cloudflare handler', async () => {
    const { onRequestPost: freshOnRequestPost } = await importFreshModule('functions/api/generate.js');
    global.fetch = mockAnthropicFetch();

    const response = await freshOnRequestPost({
      request: buildRequest(
        { agencyName: '테스트 기관', agencyType: '지방자치단체', samples: ['샘플 문구'] },
        ALLOWED_ORIGIN,
        { 'X-Forwarded-For': ',' },
      ),
      env: { ANTHROPIC_API_KEY: 'test-key' },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
  });

  it('sends an SSE error event when the 200 response stream ends with no content or done event', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"message_start","message":{"id":"msg_123"}}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"error"');
    expect(body).toContain('AI 서비스 연결에 실패했습니다');
  });

  it('fires closeReader and returns when message_stop arrives in the final buffer flush without a trailing newline', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"내용"}}\n' +
      'data: {"type":"message_stop"}',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

    const response = await vercelHandler(buildRequest({
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      samples: ['샘플 문구'],
    }));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('"type":"done"');
  });

  it('fires closeReader and returns in the Cloudflare handler when message_stop arrives in the final buffer flush without a trailing newline', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"내용"}}\n' +
      'data: {"type":"message_stop"}',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

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
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('"type":"done"');
    expect(body).not.toContain('"type":"error"');
  });

  it('rejects an array JSON body in deployed handlers', async () => {
    const vercelResponse = await vercelHandler(buildRawJsonRequest('[1,2,3]'));
    const cloudflareResponse = await onRequestPost({
      request: buildRawJsonRequest('[1,2,3]'),
      env: {},
    });

    expect(vercelResponse.status).toBe(400);
    expect(await vercelResponse.json()).toEqual({ error: '요청 형식이 올바르지 않습니다.' });

    expect(cloudflareResponse.status).toBe(400);
    expect(await cloudflareResponse.json()).toEqual({ error: '요청 형식이 올바르지 않습니다.' });
  });

  it('sends an SSE error event when the fetch itself throws in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => { throw new Error('network failure'); });

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
    expect(body).toContain('AI 서비스에 연결할 수 없습니다');
  });

  it('sends an SSE error event when the readable stream errors mid-transfer in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => {
      const readable = new ReadableStream({
        start(controller) {
          controller.error(new Error('socket dropped'));
        },
      });
      return new Response(readable, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    });

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
    expect(body).toContain('연결이 끊겼습니다');
  });

  it('sends a done SSE event when the Cloudflare stream ends normally after content without a message_stop', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"# 결과"}}\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

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
    expect(body).toContain('"type":"chunk"');
    expect(body).toContain('"type":"done"');
    expect(body).not.toContain('"type":"error"');
  });

  it('sends an SSE error event when the upstream Claude SSE stream contains a type:error event in the Cloudflare handler', async () => {
    global.fetch = vi.fn(async () => new Response(
      'data: {"type":"error","error":{"type":"overloaded_error","message":"overloaded"}}\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));

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
    expect(body).toContain('AI 처리 중 오류');
  });
});

describe('generate-shared.js — buildUserMessage and readOptionalStringField', () => {
  let buildUserMessage;
  let readOptionalStringField;

  beforeAll(async () => {
    const mod = await import('../api/shared/generate-shared.js');
    buildUserMessage = mod.buildUserMessage;
    readOptionalStringField = mod.readOptionalStringField;
  });

  it('buildUserMessage falls back to the guide-draft label and instruction when mode is unrecognised', () => {
    const result = buildUserMessage({
      mode: 'unknown-mode',
      agencyName: '테스트 기관',
      agencyType: '지방자치단체',
      screenType: '',
      toneTarget: '',
      taskBrief: '',
      samples: ['샘플 문구'],
    });
    expect(result).toContain('기관 가이드 초안');
    expect(result).toContain('샘플을 분석해 기관 전체 UX Writing 기준을 작성하세요.');
  });

  it('readOptionalStringField returns ok:true and empty value when the key is absent from the body', () => {
    const result = readOptionalStringField({}, 'screenType', 40);
    expect(result).toEqual({ ok: true, value: '' });
  });

  it('readOptionalStringField returns ok:true and empty value when the field is explicitly null', () => {
    const result = readOptionalStringField({ screenType: null }, 'screenType', 40);
    expect(result).toEqual({ ok: true, value: '' });
  });

  it('readOptionalStringField returns ok:true and empty value when the field is an empty string', () => {
    const result = readOptionalStringField({ screenType: '' }, 'screenType', 40);
    expect(result).toEqual({ ok: true, value: '' });
  });

  it('readOptionalStringField returns ok:false when the field is not a string', () => {
    const result = readOptionalStringField({ screenType: 42 }, 'screenType', 40);
    expect(result).toEqual({ ok: false, error: 'screenType 값이 올바르지 않습니다.' });
  });

  it('readOptionalStringField returns ok:false when the field exceeds maxLength', () => {
    const result = readOptionalStringField({ screenType: 'a'.repeat(41) }, 'screenType', 40);
    expect(result).toEqual({ ok: false, error: 'screenType 값이 너무 깁니다.' });
  });

  it('readOptionalStringField returns ok:true and trimmed value when the field is valid', () => {
    const result = readOptionalStringField({ screenType: '  오류 화면  ' }, 'screenType', 40);
    expect(result).toEqual({ ok: true, value: '오류 화면' });
  });

  it('buildUserMessage includes optional screenType, toneTarget, and taskBrief when present', () => {
    const result = buildUserMessage({
      mode: 'tone-adjust',
      agencyName: '서울시',
      agencyType: '지방자치단체',
      screenType: '오류 화면',
      toneTarget: '친근한 말투',
      taskBrief: '간결하게',
      samples: ['오류가 발생했습니다'],
    });
    expect(result).toContain('화면 맥락: 오류 화면');
    expect(result).toContain('목표 톤: 친근한 말투');
    expect(result).toContain('추가 요청: 간결하게');
    expect(result).toContain('톤 조정');
  });
});

describe('anthropic-edge.js — buildApiEndpoint and getAnthropicApiKey', () => {
  let buildApiEndpoint;
  let getAnthropicApiKey;

  beforeAll(async () => {
    const mod = await import('../api/shared/anthropic-edge.js');
    buildApiEndpoint = mod.buildApiEndpoint;
    getAnthropicApiKey = mod.getAnthropicApiKey;
  });

  it('buildApiEndpoint returns the fallback URL when baseUrl is not a valid URL', () => {
    expect(buildApiEndpoint('not-a-valid-url')).toBe('https://api.anthropic.com/v1/messages');
  });

  it('buildApiEndpoint appends /v1/messages when pathname is root /', () => {
    expect(buildApiEndpoint('https://proxy.example.com/')).toBe('https://proxy.example.com/v1/messages');
  });

  it('buildApiEndpoint returns URL as-is when pathname already ends with /messages', () => {
    expect(buildApiEndpoint('https://proxy.example.com/v1/messages')).toBe('https://proxy.example.com/v1/messages');
  });

  it('buildApiEndpoint appends /messages when pathname ends with /v1', () => {
    expect(buildApiEndpoint('https://proxy.example.com/v1')).toBe('https://proxy.example.com/v1/messages');
  });

  it('buildApiEndpoint appends /v1/messages for an arbitrary custom path', () => {
    expect(buildApiEndpoint('https://proxy.example.com/custom-path')).toBe(
      'https://proxy.example.com/custom-path/v1/messages',
    );
  });

  it('getAnthropicApiKey returns the configured key when ANTHROPIC_API_KEY is set', () => {
    expect(getAnthropicApiKey('https://api.anthropic.com/v1', 'sk-test-key')).toBe('sk-test-key');
  });

  it('getAnthropicApiKey returns local-llm for 127.0.0.1 loopback hostname', () => {
    expect(getAnthropicApiKey('http://127.0.0.1:11434/v1', '')).toBe('local-llm');
  });

  it('getAnthropicApiKey returns local-llm for ::1 loopback hostname', () => {
    expect(getAnthropicApiKey('http://[::1]:11434/v1', '')).toBe('local-llm');
  });

  it('getAnthropicApiKey returns local-llm for localhost hostname', () => {
    expect(getAnthropicApiKey('http://localhost:11434/v1', '')).toBe('local-llm');
  });

  it('getAnthropicApiKey returns empty string for non-loopback hostnames when no API key is set', () => {
    expect(getAnthropicApiKey('https://api.anthropic.com/v1', '')).toBe('');
  });

  it('getAnthropicApiKey returns empty string when baseUrl is invalid and apiKey is absent', () => {
    expect(getAnthropicApiKey('not-a-valid-url', '')).toBe('');
  });
});

describe('checkRateLimit — rate-limit map full with expired entries (eviction succeeds)', () => {
  it('accepts a new Vercel IP after evicting expired entries from a full rate-limit map', async () => {
    const { default: freshVercelHandler } = await importFreshModule('api/generate.js');
    const realNow = Date.now();
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
    const pastTime = realNow - RATE_LIMIT_WINDOW_MS - 1000;

    vi.spyOn(Date, 'now').mockReturnValue(pastTime);
    try {
      for (let i = 0; i < 1000; i++) {
        await freshVercelHandler(new Request('http://localhost/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: ALLOWED_ORIGIN,
            'CF-Connecting-IP': buildUniqueTestIp(i + 92000),
          },
          body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
        }));
      }

      vi.spyOn(Date, 'now').mockReturnValue(realNow);

      const response = await freshVercelHandler(new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ALLOWED_ORIGIN,
          'CF-Connecting-IP': buildUniqueTestIp(93000),
        },
        body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
      }));
      expect(response.status).not.toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('accepts a new Cloudflare IP after evicting expired entries from a full rate-limit map', async () => {
    const { onRequestPost: freshOnRequestPost } = await importFreshModule('functions/api/generate.js');
    const realNow = Date.now();
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
    const pastTime = realNow - RATE_LIMIT_WINDOW_MS - 1000;

    vi.spyOn(Date, 'now').mockReturnValue(pastTime);
    try {
      for (let i = 0; i < 1000; i++) {
        await freshOnRequestPost({
          request: new Request('http://localhost/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: ALLOWED_ORIGIN,
              'CF-Connecting-IP': buildUniqueTestIp(i + 94000),
            },
            body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
          }),
          env: { ANTHROPIC_API_KEY: 'test-key' },
        });
      }

      vi.spyOn(Date, 'now').mockReturnValue(realNow);

      const response = await freshOnRequestPost({
        request: new Request('http://localhost/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: ALLOWED_ORIGIN,
            'CF-Connecting-IP': buildUniqueTestIp(95000),
          },
          body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
        }),
        env: { ANTHROPIC_API_KEY: 'test-key' },
      });
      expect(response.status).not.toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('checkRateLimit — rate-limit map full with non-expired entries', () => {
  it('returns 429 for a new Vercel IP when the in-memory map is full of non-expired entries', async () => {
    const { default: freshVercelHandler } = await importFreshModule('api/generate.js');
    const pinnedNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(pinnedNow);
    try {
      for (let i = 0; i < 1000; i++) {
        const req = new Request('http://localhost/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: ALLOWED_ORIGIN,
            'CF-Connecting-IP': buildUniqueTestIp(i + 70000),
          },
          body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
        });
        await freshVercelHandler(req);
      }

      const newIpReq = new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: ALLOWED_ORIGIN,
          'CF-Connecting-IP': buildUniqueTestIp(80000),
        },
        body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
      });
      const response = await freshVercelHandler(newIpReq);
      expect(response.status).toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('returns 429 for a new Cloudflare IP when the in-memory map is full of non-expired entries', async () => {
    const { onRequestPost: freshOnRequestPost } = await importFreshModule('functions/api/generate.js');
    const pinnedNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(pinnedNow);
    try {
      for (let i = 0; i < 1000; i++) {
        await freshOnRequestPost({
          request: new Request('http://localhost/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Origin: ALLOWED_ORIGIN,
              'CF-Connecting-IP': buildUniqueTestIp(i + 81000),
            },
            body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
          }),
          env: { ANTHROPIC_API_KEY: 'test-key' },
        });
      }

      const response = await freshOnRequestPost({
        request: new Request('http://localhost/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: ALLOWED_ORIGIN,
            'CF-Connecting-IP': buildUniqueTestIp(91000),
          },
          body: JSON.stringify({ agencyName: '', agencyType: '', samples: [] }),
        }),
        env: { ANTHROPIC_API_KEY: 'test-key' },
      });
      expect(response.status).toBe(429);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
