import { buildApiEndpoint, getAnthropicApiKey } from './shared/anthropic-edge.js';
import {
  VALID_AGENCY_TYPES,
  VALID_GENERATOR_MODES,
  KRDS_SYSTEM_PROMPT,
  readOptionalStringField,
  buildUserMessage,
} from './shared/generate-shared.js';

export const config = { runtime: 'edge' };

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT_MAP_MAX = 1000;              // 최대 추적 IP 수
const rateLimitMap = new Map();

// CORS 허용 오리진 (배포 도메인 + 로컬 개발)
// 2026-08-21 codex 감사: Origin 강제 거부(403)를 도입하면서 Vercel 자신의
// 배포 도메인(*.vercel.app 또는 커스텀 도메인)이 이 목록에 없다는 지적을
// 받았다 — 확인 결과 이 프로젝트는 실제로 Vercel에 배포해 쓰고 있지
// 않으므로(사용자 확인) 지금은 추가하지 않는다. 나중에 실제로 Vercel
// 배포를 쓰기 시작하면 그 도메인을 반드시 여기 추가해야 한다 — 안 하면
// 배포된 사이트 자신이 /api/generate를 호출할 때도 403으로 거부된다.
const ALLOWED_ORIGINS = new Set([
  'https://thenisaid.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8300',
  'http://127.0.0.1:8300',
]);

const SERVICE_CONFIG_ERROR =
  'AI 서비스 구성이 완료되지 않았습니다. 관리자에게 문의해 주세요.';

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
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
  // 이 파일은 Vercel Edge Function 전용 배포 대상이다 — Cloudflare가 앞단에
  // 있지 않으므로 cf-connecting-ip는 Vercel이 검증·설정하는 헤더가 아니라
  // 요청자가 그대로 보낼 수 있는 값이다. x-real-ip도 Vercel 공식 문서상
  // "Vercel이 신뢰성을 보증한다"고 명시된 헤더가 아니라(프록시 설정에 따라
  // 의미가 달라짐) 신뢰할 수 없다. Vercel이 공식적으로 문서화하고 자체
  // 엣지에서 실제 클라이언트 IP를 채워 넣는다고 보증하는 값은
  // x-forwarded-for 하나뿐이므로 이것만 신뢰한다
  // (2026-08-21 /cso + codex 감사 — cf-connecting-ip/x-real-ip를 우선
  // 신뢰해 요청마다 다른 값을 보내는 것만으로 시간당 5회 제한을 우회할 수
  // 있었음. functions/api/generate.js(Cloudflare 배포)는 반대로
  // cf-connecting-ip가 실제로 신뢰 가능하므로 그쪽 로직은 유지한다).
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    const clientIp = parts[parts.length - 1];
    if (clientIp) return clientIp;
  }
  return 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // 맵 크기 초과 시 만료된 항목부터 제거
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
    return false; // eviction failed, reject
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// KV 기반 레이트 리밋 (Vercel KV / Upstash REST API)
// KV_REST_API_URL + KV_REST_API_TOKEN 환경변수가 설정된 경우에만 사용.
// 미설정 시 in-memory Map으로 폴백 (cold start 간 상태 비공유).
async function checkRateLimitKV(ip) {
  const kvUrl   = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return checkRateLimit(ip);

  const key     = `rl:${ip}`;
  const headers = { Authorization: `Bearer ${kvToken}` };
  const windowSec = Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

  try {
    const incrRes = await fetch(`${kvUrl}/incr/${key}`, { method: 'POST', headers });
    const { result: count } = await incrRes.json();
    if (typeof count !== 'number') return checkRateLimit(ip);
    if (count === 1) {
      // 첫 요청 — 윈도우 만료 설정
      await fetch(`${kvUrl}/expire/${key}/${windowSec}`, { method: 'POST', headers });
    }
    return count <= RATE_LIMIT_MAX;
  } catch (_) {
    // KV 불가 시 in-memory 폴백
    return checkRateLimit(ip);
  }
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

// ---------------------------------------------------------------------------
// 핸들러
// ---------------------------------------------------------------------------
export default async function handler(request) {
  const origin = request.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // POST 전용
  if (request.method !== 'POST') {
    return jsonResponse({ error: '허용되지 않는 메서드입니다.' }, 405, corsHeaders);
  }

  // Origin 허용 목록 강제 — CORS는 브라우저가 "응답을 읽을 수 있는지"만
  // 제어할 뿐 서버가 요청을 처리하는지는 막지 못한다. mode:'no-cors'로
  // 요청하면 응답은 못 읽어도 이 함수는 이미 실행되어 Claude API를
  // 호출해버린다 — 허용되지 않은 Origin은 처리 자체를 거부해야 한다
  // (2026-08-21 codex 감사 — 임의 웹사이트가 방문자 브라우저를 통해
  // 조용히 API 예산을 소모시킬 수 있었음).
  if (!ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: '허용되지 않은 출처입니다.' }, 403, corsHeaders);
  }

  // 레이트 리밋 (KV 우선, 폴백 in-memory)
  const ip = getClientIp(request);
  if (!await checkRateLimitKV(ip)) {
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
    process.env.ANTHROPIC_BASE_URL,
    process.env.ANTHROPIC_API_KEY
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
        buildApiEndpoint(process.env.ANTHROPIC_BASE_URL),
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
          buffer = lines.pop(); // 마지막 불완전한 줄 보존

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
