import { buildApiEndpoint, getAnthropicApiKey } from '../../api/shared/anthropic-edge.js';
import {
  VALID_AGENCY_TYPES,
  VALID_GENERATOR_MODES,
  KRDS_SYSTEM_PROMPT,
  readOptionalStringField,
  buildUserMessage,
} from '../../api/shared/generate-shared.js';

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT_MAP_MAX = 1000;
const rateLimitMap = new Map();

const ALLOWED_ORIGINS = new Set([
  'https://thenisaid.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8300',
  'http://127.0.0.1:8300',
]);
const SERVICE_CONFIG_ERROR =
  'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.';

function jsonResponse(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {}),
    },
  });
}

function getClientIp(request) {
  // 이 파일은 Cloudflare Pages Functions 전용 배포 대상이다 — Cloudflare가
  // 실제로 연결을 종단하므로 cf-connecting-ip는 Cloudflare가 검증·설정하는
  // 신뢰 가능한 헤더다. 반면 x-real-ip는 Cloudflare가 보증하는 헤더가
  // 아니므로(설정에 따라 의미가 달라짐) 신뢰하지 않는다
  // (2026-08-21 /cso + codex 감사 — 대칭적으로 api/generate.js(Vercel
  // 배포)에서는 반대로 cf-connecting-ip를 신뢰할 수 없어 제거했다).
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const clientIp = forwarded
      .split(',')
      .map((part) => part.trim())
      .find(Boolean);
    if (clientIp) return clientIp;
  }
  return 'unknown';
}

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : null;
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': allowed } : {}),
    'Vary': 'Origin',
  };
}

function isRequestPayloadObject(body) {
  return !!body && typeof body === 'object' && !Array.isArray(body);
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    if (rateLimitMap.size >= RATE_LIMIT_MAP_MAX) {
      for (const [k, v] of rateLimitMap) {
        if (now - v.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(k);
        if (rateLimitMap.size < RATE_LIMIT_MAP_MAX) break;
      }
    }
    if (rateLimitMap.size < RATE_LIMIT_MAP_MAX) {
      rateLimitMap.set(ip, { windowStart: now, count: 1 });
      return true;
    }
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Cloudflare Pages Functions 핸들러
// ---------------------------------------------------------------------------
export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || context.request.headers.get('origin') || '';
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(origin),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  // Origin 허용 목록 강제 — api/generate.js와 동일한 이유
  // (2026-08-21 codex 감사, no-cors 요청으로 응답을 못 읽어도 처리 자체는
  // 이미 실행돼버리는 문제).
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: '허용되지 않은 출처입니다.' }, 403, corsHeaders);
  }

  // 레이트 리밋
  const ip = getClientIp(request);
  if (!checkRateLimit(ip)) {
    return jsonResponse(
      { error: '요청 한도를 초과했습니다. 1시간 후 다시 시도해 주세요.' },
      429,
      corsHeaders
    );
  }

  // 바디 파싱
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400, corsHeaders);
  }

  if (!isRequestPayloadObject(body)) {
    return jsonResponse({ error: '요청 형식이 올바르지 않습니다.' }, 400, corsHeaders);
  }

  const agencyName = typeof body.agencyName === 'string' ? body.agencyName : '';
  const agencyType = body.agencyType;
  const samples = body.samples;
  const mode = typeof body.mode === 'string' && body.mode.trim()
    ? body.mode.trim()
    : 'guide-draft';

  // 서버사이드 유효성 검사
  if (
    agencyName.trim().length < 1 ||
    agencyName.trim().length > 50
  ) {
    return jsonResponse(
      { error: '기관명은 1~50자 사이여야 합니다.' },
      400,
      corsHeaders
    );
  }

  if (!VALID_AGENCY_TYPES.includes(agencyType)) {
    return jsonResponse(
      { error: '올바른 기관 유형을 선택해 주세요.' },
      400,
      corsHeaders
    );
  }

  if (!VALID_GENERATOR_MODES.includes(mode)) {
    return jsonResponse(
      { error: '올바른 작업 모드를 선택해 주세요.' },
      400,
      corsHeaders
    );
  }

  if (!Array.isArray(samples) || samples.length === 0) {
    return jsonResponse(
      { error: '샘플 텍스트를 1개 이상 입력해 주세요.' },
      400,
      corsHeaders
    );
  }

  if (samples.length > 3) {
    return jsonResponse(
      { error: '샘플 텍스트는 최대 3개까지 입력할 수 있습니다.' },
      400,
      corsHeaders
    );
  }

  const validSamples = samples.filter(
    (s) => typeof s === 'string' && s.trim().length >= 1
  );

  if (validSamples.length === 0) {
    return jsonResponse(
      { error: '유효한 샘플 텍스트를 1개 이상 입력해 주세요.' },
      400,
      corsHeaders
    );
  }

  for (const s of validSamples) {
    if (s.trim().length > 500) {
      return jsonResponse(
        { error: '각 샘플 텍스트는 500자 이하여야 합니다.' },
        400,
        corsHeaders
      );
    }
  }

  const screenTypeField = readOptionalStringField(body, 'screenType', 40);
  if (!screenTypeField.ok) {
    return jsonResponse({ error: '화면 맥락 값을 확인해 주세요.' }, 400, corsHeaders);
  }

  const toneTargetField = readOptionalStringField(body, 'toneTarget', 40);
  if (!toneTargetField.ok) {
    return jsonResponse({ error: '목표 톤 값을 확인해 주세요.' }, 400, corsHeaders);
  }

  const taskBriefField = readOptionalStringField(body, 'taskBrief', 300);
  if (!taskBriefField.ok) {
    return jsonResponse({ error: '추가 요청은 300자 이하여야 합니다.' }, 400, corsHeaders);
  }

  const anthropicApiKey = getAnthropicApiKey(
    env.ANTHROPIC_BASE_URL,
    env.ANTHROPIC_API_KEY
  );

  if (!anthropicApiKey) {
    return jsonResponse(
      { error: SERVICE_CONFIG_ERROR },
      503,
      corsHeaders
    );
  }

  const userMessage = buildUserMessage({
    mode,
    agencyName,
    agencyType,
    screenType: screenTypeField.value,
    toneTarget: toneTargetField.value,
    taskBrief: taskBriefField.value,
    samples: validSamples,
  });

  // SSE 스트리밍 응답 구성
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  function writeSSE(data) {
    const line = 'data: ' + JSON.stringify(data) + '\n\n';
    writer.write(encoder.encode(line));
  }

  // Claude API 호출 (백그라운드)
  (async () => {
    try {
      const claudeResponse = await fetch(
        buildApiEndpoint(env.ANTHROPIC_BASE_URL),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: mode === 'derivative-guide' ? 2800 : 2200,
            stream: true,
            system: KRDS_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!claudeResponse.ok) {
        writeSSE({
          type: 'error',
          message:
            'AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도하거나 기본 양식을 사용해 주세요.',
        });
        writer.close();
        return;
      }

      const reader = claudeResponse.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let sawContent = false;

      async function closeReader() {
        try { await reader.cancel(); } catch { /* ignore */ }
      }

      function getSseDataPayload(line) {
        const trimmed = String(line || '').trim();
        if (!trimmed.startsWith('data:')) return null;

        const data = trimmed.slice(5);
        return data.startsWith(' ') ? data.slice(1) : data;
      }

      function processClaudeLine(line) {
        const jsonStr = getSseDataPayload(line);
        if (jsonStr === null) return false;
        if (jsonStr === '[DONE]') return false;

        let evt;
        try {
          evt = JSON.parse(jsonStr);
        } catch {
          return false;
        }

        if (
          evt.type === 'content_block_delta' &&
          evt.delta?.type === 'text_delta'
        ) {
          sawContent = true;
          writeSSE({ type: 'chunk', text: evt.delta.text });
          return false;
        }

        if (evt.type === 'message_stop') {
          writeSSE({ type: 'done' });
          writer.close();
          return true;
        }

        if (evt.type === 'error') {
          writeSSE({
            type: 'error',
            message:
              'AI 처리 중 오류가 발생했습니다. 다시 시도하거나 기본 양식을 사용해 주세요.',
          });
          writer.close();
          return true;
        }

        return false;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (processClaudeLine(line)) { await closeReader(); return; }
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          if (processClaudeLine(buffer)) { await closeReader(); return; }
        }

        if (sawContent) {
          writeSSE({ type: 'done' });
        } else {
          writeSSE({
            type: 'error',
            message:
              'AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도하거나 기본 양식을 사용해 주세요.',
          });
        }
        writer.close();
      } catch {
        await closeReader();
        writeSSE({
          type: 'error',
          message:
            '연결이 끊겼습니다. 다시 시도하거나 기본 양식을 사용해 주세요.',
        });
        writer.close();
      }
    } catch {
      writeSSE({
        type: 'error',
        message:
          'AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도하거나 기본 양식을 사용해 주세요.',
      });
      writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...corsHeaders,
    },
  });
}
