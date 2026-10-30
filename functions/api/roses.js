// GET  /api/roses  -> { count, people, recent: [{ name, place }] }
// POST /api/roses  { deviceId, token? }            -> lays one more rose (up to 10 per device)
// PUT  /api/roses  { deviceId, name, place? }      -> puts a name on this device's roses
import { json, clean, validDevice, ipHash, verifyTurnstile, readJson } from '../../lib/util.js';

const MAX_PER_DEVICE = 10;
const IP_DAILY_LIMIT = 500; // new visitors per connection per day; many people share one mobile-network address

async function snapshot(env) {
  const [total, people, named] = await env.DB.batch([
    env.DB.prepare("SELECT value FROM stats WHERE key = 'roses'"),
    env.DB.prepare('SELECT COUNT(*) AS n FROM roses'),
    env.DB.prepare("SELECT name, place FROM roses WHERE status = 'visible' AND name IS NOT NULL AND name <> '' ORDER BY named_at DESC, id DESC LIMIT 40"),
  ]);
  return { count: total.results[0]?.value || 0, people: people.results[0]?.n || 0, recent: named.results || [] };
}

export async function onRequestGet({ env }) {
  return json(await snapshot(env), 200, { 'cache-control': 'public, max-age=10' });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400);

  const mine = await env.DB.prepare('SELECT roses FROM roses WHERE device_id = ?').bind(body.deviceId).first();
  if (mine && mine.roses >= MAX_PER_DEVICE) return json({ error: 'limit_reached', mine: mine.roses, ...(await snapshot(env)) }, 409);

  if (!mine) {
    // first rose from this device: spam check and per-connection limit
    if (!(await verifyTurnstile(body.token, request, env))) return json({ error: 'verification_failed' }, 403);
    const ip = await ipHash(request, env);
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM roses WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"
    ).bind(ip).first();
    if (recent && recent.n >= IP_DAILY_LIMIT) return json({ error: 'rate_limited' }, 429);
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO roses (device_id, ip_hash, roses) VALUES (?, ?, 1)').bind(body.deviceId, ip).run();
    if (!ins.meta?.changes) return json({ error: 'try_again' }, 409);
  } else {
    const up = await env.DB.prepare('UPDATE roses SET roses = roses + 1 WHERE device_id = ? AND roses < ?').bind(body.deviceId, MAX_PER_DEVICE).run();
    if (!up.meta?.changes) return json({ error: 'limit_reached', mine: MAX_PER_DEVICE, ...(await snapshot(env)) }, 409);
  }
  await env.DB.prepare("UPDATE stats SET value = value + 1 WHERE key = 'roses'").run();
  return json({ ok: true, mine: (mine ? mine.roses : 0) + 1, ...(await snapshot(env)) }, 201);
}

export async function onRequestPut({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400);
  const name = clean(body.name, 60);
  const place = clean(body.place, 60) || null;
  if (name.length < 2) return json({ error: 'name_required' }, 400);
  const res = await env.DB.prepare(
    "UPDATE roses SET name = ?, place = ?, named_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE device_id = ?"
  ).bind(name, place, body.deviceId).run();
  if (!res.meta?.changes) return json({ error: 'bad_request' }, 404);
  return json({ ok: true, ...(await snapshot(env)) });
}
