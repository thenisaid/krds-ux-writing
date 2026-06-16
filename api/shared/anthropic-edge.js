function isLoopbackHost(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function buildApiEndpoint(baseUrl) {
  const fallback = 'https://api.anthropic.com/v1/messages';
  const raw = String(baseUrl || 'https://api.anthropic.com/v1').trim();

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return fallback;
  }

  let pathname = parsed.pathname.replace(/\/+$/, '');

  if (!pathname || pathname === '/') {
    pathname = '/v1/messages';
  } else if (/\/messages$/i.test(pathname)) {
    parsed.pathname = pathname;
    return parsed.toString();
  } else if (/\/v1$/i.test(pathname)) {
    pathname += '/messages';
  } else {
    pathname += '/v1/messages';
  }

  parsed.pathname = pathname;
  return parsed.toString();
}

export function getAnthropicApiKey(baseUrl, apiKey) {
  const configuredKey = String(apiKey || '').trim();
  if (configuredKey) return configuredKey;

  try {
    const parsed = new URL(String(baseUrl || 'https://api.anthropic.com/v1').trim());
    return isLoopbackHost(parsed.hostname) ? 'local-llm' : '';
  } catch {
    return '';
  }
}
