/**
 * GS3D quote file uploads → Vercel Blob (public store "gs3d-quote-public").
 *
 * Hobby-plan-safe: this function only *presigns* (tiny JSON in/out). The
 * actual bytes travel browser → Vercel Blob storage directly, so the 4.5 MB
 * function body cap never applies.
 *
 * POST { files: [{ name, type, size }] }
 * → { ok, files: [{ name, ok, putUrl, putHeaders, publicUrl, error? }] }
 *
 * Vercel injects BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID for the linked store.
 */
import { presignUrl, issueSignedToken } from "@vercel/blob";

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

async function readRaw(req) {
  if (typeof req.text === "function") {
    try { return await req.text(); } catch { return ""; }
  }
  let data = "";
  try { for await (const chunk of req) data += chunk; } catch { return ""; }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  let parsed;
  try {
    const raw = await readRaw(req);
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    res.status(400).json({ ok: false, error: "bad_body" });
    return;
  }

  const incoming = Array.isArray(parsed?.files) ? parsed.files.slice(0, MAX_FILES) : [];
  if (incoming.length === 0) {
    res.status(400).json({ ok: false, error: "no_files" });
    return;
  }

  const rw = process.env.BLOB_READ_WRITE_TOKEN;
  // One short-lived delegation token covers the whole batch (server-side only).
  let signed;
  try {
    signed = await issueSignedToken({
      token: rw,
      operations: ["put"],
      validFor: 1800,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "sign_failed: " + String(err?.message || err).slice(0, 140) });
    return;
  }

  const results = [];
  const ts = Date.now();
  for (let i = 0; i < incoming.length; i++) {
    const f = incoming[i] || {};
    const name = String(f.name || `file-${i + 1}`).slice(0, 120);
    if (typeof f.size === "number" && f.size > MAX_FILE_MB * 1024 * 1024) {
      results.push({ name, ok: false, error: "too_large" });
      continue;
    }
    const ext = String(f.name || "").split(".").pop();
    const extSafe = /^\w{1,8}$/.test(ext || "") ? ext : "bin";
    // Strip the original extension from the sanitized base so it isn't doubled.
    const base = String(sanitize(f.name, i)).replace(/\.[^.\s]+$/, "");
    const key = `quotes/${ts}-${i}-${base}.${extSafe}`;
    try {
      const presigned = await presignUrl(signed, {
        pathname: key,
        access: "public",
        operation: "put",
      });
      const putUrl = presigned.presignedUrl;
      // Serve through our own /files/ proxy so browsers render images
      // inline (the blob store defaults to attachment / download).
      // Relative on purpose: the file must be fetched from whichever host is
      // serving the page (www.gs3dprinting.com, gs3d-rebuild.vercel.app, …).
      // An absolute URL to another host is blocked by our img-src 'self' CSP.
      const publicUrl = `/files/${key
        .replace(/#/g, "%23")
        .replace(/\?/g, "%3F")}`;
      results.push({ name, ok: true, putUrl, putHeaders: presigned.headers || {}, publicUrl });
    } catch (err) {
      results.push({ name, ok: false, error: String(err?.message || err).slice(0, 140) });
    }
  }

  res.status(200).json({ ok: true, files: results });
}
