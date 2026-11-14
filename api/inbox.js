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
import { createHash, timingSafeEqual } from "node:crypto";

const MAX_FILE_MB = 25;
const MAX_FILES = 10;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

const FORM_FIELDS = ["name", "phone", "company", "email", "service", "deadline", "message"];

/* Match the quote-upload allowlist so an inbox record can never point at an
   executable HTML/SVG upload. */
const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "heic", "heif",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods",
  "zip", "rar", "7z", "tar", "gz", "tgz",
  "stl", "step", "stp", "iges", "igs", "obj", "3mf", "fbx", "dwg", "dxf", "skp",
  "blend", "glb", "gltf", "ply", "dae", "3ds", "max", "prt", "sldprt", "sldasm",
  "ipt", "iam", "x_t", "x_b", "sat", "jt", "wrl", "vrml", "catpart", "catproduct"
]);

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/bmp",
  "image/heic", "image/heif", "image/vnd.dwg", "image/vnd.dxf",
  "application/pdf", "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text", "application/vnd.oasis.opendocument.spreadsheet",
  "text/plain", "text/csv", "application/rtf",
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/x-tar", "application/gzip",
  "application/octet-stream", "application/step", "application/sla", "application/iges",
  "application/vnd.sketchup.skp", "model/*"
];

function extOf(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return /^\w{1,8}$/.test(ext || "") ? ext : "";
}

/* Only keep our own /files/ path (current records) or map legacy absolute
   Vercel Blob URLs onto it. Anything else is dropped, so a submitted record
   cannot inject javascript:/data: links into the admin panel. */
function safeFileUrl(raw) {
  try {
    const u = new URL(String(raw || ""), "https://gs3dprinting.com");
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    const ext = extOf(u.pathname);
    if (!ext || !ALLOWED_EXT.has(ext)) return "";
    if (u.pathname.indexOf("/files/") === 0) return u.pathname + u.search;
    if (/\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)) return "/files" + u.pathname + u.search;
  } catch { /* malformed URL */ }
  return "";
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.protocol !== "https:") return false;
    if (url.hostname === "gs3dprinting.com" || url.hostname === "www.gs3dprinting.com") return true;
    if (/^gs3d-rebuild(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(url.hostname)) return true;
    const base = process.env.PUBLIC_BASE_URL;
    if (base) {
      try { if (url.host === new URL(base).host) return true; } catch { /* ignore bad env value */ }
    }
  } catch { /* malformed Origin */ }
  return false;
}

/* Hash both sides so timingSafeEqual sees equal-length buffers. */
function passwordOk(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const given = String(req.headers["x-admin-pass"] || "");
  if (!expected || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

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
  res.setHeader("Cache-Control", "no-store");

  // ---- POST: presign or record ----
  if (req.method === "POST") {
    if (!isSameOrigin(req)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    let body;
    try { body = req.body; } catch { return res.status(400).json({ ok: false, error: "bad_body" }); }
    const op = String(body?.op || "");

    if (op === "test-notify") {
      if (!passwordOk(req)) {
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
          const ext = extOf(name);
          if (!ext || !ALLOWED_EXT.has(ext)) {
            items.push({ name, ok: false, error: "type_not_allowed" });
            continue;
          }
          if (!Number.isFinite(f.size) || f.size <= 0) {
            items.push({ name, ok: false, error: "invalid_size" });
            continue;
          }
          if (f.size > MAX_BYTES) {
            items.push({ name, ok: false, error: "too_large" });
            continue;
          }
          const key = `inbox/files/${ts}-${i}-${sanitize(f.name, i)}`;
          const presigned = await presignUrl(signed, {
            pathname: key,
            access: "public",
            operation: "put",
            maximumSizeInBytes: MAX_BYTES,
            allowedContentTypes: ALLOWED_TYPES,
          });
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
      if (!body.form || typeof body.form !== "object" || Array.isArray(body.form) || !Array.isArray(body.files)) {
        return res.status(400).json({ ok: false, error: "bad_record" });
      }
      try {
        const signed = await sign(store, ["put"]);
        const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const form = {};
        for (const [k, v] of Object.entries(body.form)) {
          if (FORM_FIELDS.includes(k)) form[k] = String(v ?? "").slice(0, 2000);
        }
        const requestedTs = Number(body.ts);
        const ts = Number.isFinite(requestedTs) && requestedTs > 0 && requestedTs <= Date.now() + 86400000
          ? requestedTs
          : Date.now();
        const files = body.files.slice(0, MAX_FILES).map((f) => ({
          name: String(f?.name || "").slice(0, 160),
          url: safeFileUrl(f?.url),
        })).filter((f) => f.url);
        const record = { id, ts, form, files };
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
    if (!passwordOk(req)) {
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
