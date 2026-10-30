// Shared helpers for the memorial site's API.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders },
  });
}

// Single-line text: strip control characters, collapse spaces, cap length.
export function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Multi-line text: keep line breaks, drop other control characters, cap length.
export function cleanMessage(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export const hasLink = (text) => /(https?:\/\/|www\.)\S/i.test(text);

export function validDevice(id) {
  return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id);
}

// A one-way hash of the visitor's IP address, used only for rate limits.
export async function ipHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const bytes = new TextEncoder().encode((env.HASH_SALT || 'memorial-salt') + ':' + ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Cloudflare Turnstile check. Skipped when no secret is configured.
export async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token || typeof token !== 'string') return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = await res.json();
    return out.success === true;
  } catch {
    return false;
  }
}

export async function readJson(request, maxBytes = 6000) {
  const text = await request.text();
  if (text.length > maxBytes) throw new Error('too_large');
  return JSON.parse(text || '{}');
}
