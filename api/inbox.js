/**
 * GS3D inbox → Vercel Blob.
 *
 * presign: POST { files: [{name, type, size}] }
 *   -> { ok, items: [{ name, key, putUrl, publicUrl }] }
 *      (uploads bytes browser → blob directly; only JSON goes through the fn)
 *
 * record:  POST { id?, form, files: [{name, url}], ts }
 *   -> stores inbox/<ts>-<rand>.json (id is generated server-side)
 *
 * list:    GET  -> [record, ...] sorted newest first
 */
import { put, presignUrl, issueSignedToken, list } from "@vercel/blob";
import { createHash } from "node:crypto";

const MAX_FILE_MB = 25;
const MAX_FILES = 10;

function sanitize(name, i) {
  const base = String(name || `file-${i + 1}`)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `file-${i + 1}`;
}

function sign(store, operations) {
  const rw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!rw) throw new Error("missing blob credential");
  return issueSignedToken({ token: rw, store, operations, validFor: 3600 });
}

/* ---------- owner alerts ----------
 * Every channel below is optional and independent. With nothing configured the
 * enquiry is still stored and the admin dashboard's live polling still
 * announces it; the server simply has nowhere to push.
 *
 *   ntfy      no setup: the topic is derived from ADMIN_PASSWORD and shown in
 *             the admin. Subscribe on a phone at https://ntfy.sh/<topic>.
 *             NTFY_TOPIC / NTFY_SERVER / NTFY_TOKEN override it.
 *   telegram  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 *   slack     SLACK_WEBHOOK_URL
 *   discord   DISCORD_WEBHOOK_URL
 *   email     RESEND_API_KEY (+ ENQUIRY_NOTIFY_TO / ENQUIRY_NOTIFY_FROM)
 *   webhook   NOTIFY_WEBHOOK_URL, receives { title, text, record }
 */

function alertTopic() {
  if (process.env.NTFY_TOPIC) return process.env.NTFY_TOPIC;
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return "gs3d-" + createHash("sha256").update("gs3d-alerts-v1:" + secret).digest("hex").slice(0, 24);
}

function ntfyServer() {
  return (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");
}

/** HTTP headers must be ASCII; drop em dashes and any other non-ASCII. */
function headerSafe(s) {
  return String(s || "").replace(/[^\x20-\x7E]/g, "").slice(0, 120);
}

function enquiryText(record) {
  const form = record.form || {};
  const files = (record.files || []).length;
  const lines = [`Name: ${form.name || "-"}`, `Phone: ${form.phone || "-"}`];
  if (form.email) lines.push(`Email: ${form.email}`);
  if (form.company) lines.push(`Company: ${form.company}`);
  if (form.service) lines.push(`Service: ${form.service}`);
  if (form.deadline) lines.push(`Needed by: ${form.deadline}`);
  if (form.message) lines.push("", String(form.message).slice(0, 600));
  if (files) lines.push("", `${files} attachment${files > 1 ? "s" : ""} in the admin`);
  return lines.join("\n");
}

async function sendTelegram(title, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return null;
  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: `${title}\n\n${text}`.slice(0, 3900), disable_web_page_preview: true }),
  });
  let error;
  if (!resp.ok) {
    try { error = (await resp.json())?.description; } catch { error = `HTTP ${resp.status}`; }
  }
  return { channel: "telegram", ok: resp.ok, error };
}

async function sendNtfy(title, text) {
  const topic = alertTopic();
  if (!topic) return null;
  const headers = { Title: headerSafe(title), Priority: "high", Tags: "bell" };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  const resp = await fetch(`${ntfyServer()}/${encodeURIComponent(topic)}`, { method: "POST", headers, body: text });
  return { channel: "ntfy", ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function sendSlack(title, text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return null;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `*${title}*\n${text}` }),
  });
  return { channel: "slack", ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function sendDiscord(title, text) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return null;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `**${title}**\n${text}`.slice(0, 1900) }),
  });
  return { channel: "discord", ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function sendWebhook(title, text, record) {
  const url = process.env.NOTIFY_WEBHOOK_URL;
  if (!url) return null;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, text, record }),
  });
  return { channel: "webhook", ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function sendEmail(title, text) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const to = process.env.ENQUIRY_NOTIFY_TO || "gs3dprinting@gmail.com";
  const from = process.env.ENQUIRY_NOTIFY_FROM || "GS3D Website <onboarding@resend.dev>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject: title, text }),
  });
  return { channel: "email", ok: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function notifyAll(record, isTest) {
  const name = (record.form && record.form.name) || "the website";
  const title = isTest ? "GS3D test alert" : `New enquiry from ${name}`;
  const text = (isTest ? "Test alert from the GS3D inbox.\n\n" : "") + enquiryText(record);
  const results = [];
  for (const send of [sendTelegram, sendNtfy, sendSlack, sendDiscord, sendWebhook, sendEmail]) {
    try {
      const r = await send(title, text, record);
      if (r) results.push(r);
    } catch (err) {
      results.push({ channel: send.name.replace(/^send/, "").toLowerCase(), ok: false, error: String(err?.message || err).slice(0, 120) });
    }
  }
  return results;
}

/** Never throws: a failed alert must not fail the enquiry itself. */
async function notifyOwner(record) {
  try {
    const results = await notifyAll(record, false);
    for (const r of results) if (!r.ok) console.error("alert failed", r.channel, r.error);
  } catch (err) {
    console.error("alert error", String(err?.message || err));
  }
}

export default async function handler(req, res) {
  const store = process.env.BLOB_STORE_ID || "store_QqMBiCBONsvyjsy0";

  // ---- POST: presign or record ----
  if (req.method === "POST") {
    let body;
    try { body = req.body; } catch { return res.status(400).json({ ok: false, error: "bad_body" }); }
    const op = String(body?.op || "");

    if (op === "test-notify") {
      const pass = String(req.headers["x-admin-pass"] || "");
      if (!pass || pass !== process.env.ADMIN_PASSWORD) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
      const channels = await notifyAll(
        {
          id: "test",
          ts: Date.now(),
          form: { name: "Test alert", phone: "+91 00000 00000", service: "3D printing", message: "Test notification from your GS3D inbox." },
          files: [],
        },
        true
      );
      return res.status(200).json({ ok: true, channels, alertTopic: alertTopic() });
    }

    if (op === "presign") {
      const files = Array.isArray(body.files) ? body.files.slice(0, MAX_FILES) : [];
      if (!files.length) return res.status(400).json({ ok: false, error: "no_files" });
      try {
        const signed = await sign(store, ["put"]);
        const ts = Date.now();
        const items = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i] || {};
          const name = String(f.name || `file-${i + 1}`).slice(0, 120);
          const key = `inbox/files/${ts}-${i}-${sanitize(f.name, i)}`;
          const presigned = await presignUrl(signed, { pathname: key, access: "public", operation: "put" });
          const pubHost = store.replace(/^store_/, "").toLowerCase();
          items.push({
            name,
            key,
            putUrl: presigned.presignedUrl,
            // Keep "/" literal (the /files/:path* rewrite depends on it);
            // names are already sanitized to [A-Za-z0-9._-].
            publicUrl: `${process.env.PUBLIC_BASE_URL || "https://gs3dprinting.com"}/files/${key}`,
          });
        }
        res.status(200).json({ ok: true, items });
      } catch (err) {
        res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 160) });
      }
      return;
    }

    if (op === "record") {
      if (!body.form || !body.files || !Array.isArray(body.files)) {
        return res.status(400).json({ ok: false, error: "bad_record" });
      }
      try {
        const signed = await sign(store, ["put"]);
        const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const record = {
          id,
          ts: body.ts || Date.now(),
          form: Object.fromEntries(
            Object.entries(body.form).map(([k, v]) => [k, String(v || "").slice(0, 2000)])
          ),
          files: body.files.slice(0, MAX_FILES).map((f) => ({
            name: String(f.name || "").slice(0, 160),
            url: String(f.url || "").slice(0, 400),
          })),
        };
        const key = `inbox/${id}.json`;
        const presigned = await presignUrl(signed, { pathname: key, access: "public", operation: "put" });
        const resp = await fetch(presigned.presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });
        if (resp.status !== 200 && resp.status !== 201) {
          return res.status(500).json({ ok: false, error: "record_write_failed" });
        }
        await notifyOwner(record);
        res.status(200).json({ ok: true, id });
      } catch (err) {
        res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 160) });
      }
      return;
    }

    res.status(400).json({ ok: false, error: "unknown_op" });
    return;
  }

  // ---- GET: list records ----
  if (req.method === "GET") {
    const pass = String(req.headers["x-admin-pass"] || "");
    if (!pass || pass !== process.env.ADMIN_PASSWORD) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    try {
      const rw = process.env.BLOB_READ_WRITE_TOKEN;
      const out = [];
      let cursor = undefined;
      for (let page = 0; page < 5; page++) {
        const result = await list({
          token: rw,
          store,
          limit: 1000,
          cursor,
          prefix: "inbox/",
          mode: "expanded",
        });
        for (const b of result.blobs) {
          if (!b.pathname.endsWith(".json")) continue;
          const got = await fetch(b.url, { cache: "no-store" });
          if (got.ok) {
            try { out.push(await got.json()); } catch { /* skip corrupt */ }
          }
        }
        cursor = result.cursor;
        if (result.blobs.length < 1000 || !cursor) break;
      }
      out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      res.status(200).json({ ok: true, records: out, alertTopic: alertTopic() });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 160) });
    }
    return;
  }

  res.status(405).json({ ok: false, error: "method_not_allowed" });
}

export const config = {
  api: {
    bodyParser: { type: "application/json", sizeLimit: "1mb" },
  },
};
