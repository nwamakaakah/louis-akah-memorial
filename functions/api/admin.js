// Family moderation. Every request needs the header  x-admin-key: <ADMIN_KEY secret>
// GET  /api/admin?type=condolences|roses       -> latest entries in every status
// POST /api/admin { type, id, status }          -> show, hide or approve one entry
import { json, readJson } from '../../lib/util.js';

function authorised(request, env) {
  const given = request.headers.get('x-admin-key') || '';
  const secret = env.ADMIN_KEY || '';
  if (!secret || given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

const TABLES = {
  condolences: { sql: 'SELECT id, name, place, message, status, created_at FROM condolences ORDER BY id DESC LIMIT 500', statuses: ['visible', 'hidden', 'pending'] },
  roses: { sql: "SELECT id, name, place, status, created_at FROM roses WHERE name IS NOT NULL AND name <> '' ORDER BY id DESC LIMIT 500", statuses: ['visible', 'hidden'] },
};

export async function onRequest({ request, env }) {
  if (!env.ADMIN_KEY) return json({ error: 'admin_not_configured' }, 503);
  if (!authorised(request, env)) return json({ error: 'unauthorised' }, 401);

  if (request.method === 'GET') {
    const type = new URL(request.url).searchParams.get('type') || 'condolences';
    const table = TABLES[type];
    if (!table) return json({ error: 'bad_request' }, 400);
    const { results } = await env.DB.prepare(table.sql).all();
    const stats = await env.DB.prepare("SELECT value FROM stats WHERE key = 'roses'").first();
    return json({ items: results || [], roses: stats ? stats.value : 0 });
  }

  if (request.method === 'POST') {
    let body;
    try { body = await readJson(request); } catch { return json({ error: 'bad_request' }, 400); }
    const table = TABLES[body.type];
    const id = parseInt(body.id, 10);
    if (!table || !id || !table.statuses.includes(body.status)) return json({ error: 'bad_request' }, 400);
    await env.DB.prepare(`UPDATE ${body.type} SET status = ? WHERE id = ?`).bind(body.status, id).run();
    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, 405);
}
