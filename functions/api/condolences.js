// POST /api/condolences { deviceId, name, place?, message, token? }
// Nothing is published automatically. Each message is emailed to the family
// (FAMILY_EMAIL) and kept in the database as 'pending' as a backup copy.
// The family adds the messages they choose to public/index.html themselves.
import { json, clean, cleanMessage, hasLink, validDevice, ipHash, verifyTurnstile, readJson } from '../../lib/util.js';

const PAGE = 20;
const IP_DAILY_LIMIT = 300;
const DAY_AGO = "strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validDevice(body.deviceId)) return json({ error: 'bad_request' }, 400);

  const name = clean(body.name, 80);
  const place = clean(body.place, 80) || null;
  const message = cleanMessage(body.message, 1000);
  if (name.length < 2) return json({ error: 'name_required' }, 400);
  if (message.length < 2) return json({ error: 'message_required' }, 400);
  if (hasLink(message) || hasLink(name) || (place && hasLink(place))) return json({ error: 'no_links' }, 400);
  if (!(await verifyTurnstile(body.token, request, env))) return json({ error: 'verification_failed' }, 403);

  const ip = await ipHash(request, env);
  const [byDevice, byIp] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM condolences WHERE device_id = ?').bind(body.deviceId),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM condolences WHERE ip_hash = ? AND created_at > ${DAY_AGO}`).bind(ip),
  ]);
  // One message per device, ever.
  if ((byDevice.results[0]?.n || 0) >= 1) return json({ error: 'already_sent' }, 409);
  if ((byIp.results[0]?.n || 0) >= IP_DAILY_LIMIT) {
    return json({ error: 'rate_limited' }, 429);
  }

  const item = await env.DB.prepare(
    "INSERT INTO condolences (name, place, message, device_id, ip_hash, status) VALUES (?, ?, ?, ?, ?, 'pending') RETURNING id, created_at"
  ).bind(name, place, message, body.deviceId, ip).first();

  const sent = await emailFamily(env, { name, place, message, id: item.id });
  if (!sent) return json({ error: 'send_failed' }, 502);
  return json({ ok: true }, 201);
}

// Sends the message to the family through Resend (resend.com, free for this volume).
async function emailFamily(env, m) {
  // Until email is set up, messages are only saved; the family reads them on /admin.
  if (!env.RESEND_API_KEY || !env.FAMILY_EMAIL) return true;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const from = m.place ? `${m.name}, ${m.place}` : m.name;
  let res;
  try {
  res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Memorial site <onboarding@resend.dev>',
      to: env.FAMILY_EMAIL.split(',').map((s) => s.trim()),
      subject: `Condolence message from ${m.name}`,
      text: `${m.message}\n\n${from}\n\n(Message #${m.id} from the memorial site. Nothing has been published.)`,
      html: `<div style="font-family:Georgia,serif;font-size:17px;line-height:1.6;color:#241e1b">` +
        `<p style="white-space:pre-line">${esc(m.message)}</p><p><strong>${esc(m.name)}</strong>${m.place ? `<br><em>${esc(m.place)}</em>` : ''}</p>` +
        `<p style="font-family:Arial,sans-serif;font-size:12px;color:#7a6c62">Message #${m.id} from the memorial site. Nothing has been published.</p></div>`,
    }),
  });
  } catch { return false; }
  return res.ok;
}
