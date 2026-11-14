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
import { randomUUID } from "node:crypto";

const MAX_FILE_MB = 25;
const MAX_FILES = 10;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

/* Only allow file types the quote form is meant to receive. Anything that can
   execute in a browser (html, svg, js, xml, …) is rejected so a public blob
   URL cannot become a same-origin script. */
const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "heic", "heif",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "odt", "ods",
  "zip", "rar", "7z", "tar", "gz", "tgz",
  "stl", "step", "stp", "iges", "igs", "obj", "3mf", "fbx", "dwg", "dxf", "skp",
  "blend", "glb", "gltf", "ply", "dae", "3ds", "max", "prt", "sldprt", "sldasm",
  "ipt", "iam", "x_t", "x_b", "sat", "jt", "wrl", "vrml", "catpart", "catproduct"
]);

/* Keep uploads to content types a browser can only render as data. SVG, HTML,
   XML and JavaScript are deliberately absent. */
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

/* Browsers send Origin on same-origin POSTs. Allowing an absent Origin keeps
   non-browser callers working, while rejecting a foreign Origin blocks the
   obvious cross-site abuse path. */
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
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }
  if (!isSameOrigin(req)) {
    res.status(403).json({ ok: false, error: "forbidden" });
    return;
  }

  let parsed;
  try {
    const raw = await readRaw(req);
    if (raw.length > 20_000) {
      res.status(413).json({ ok: false, error: "body_too_large" });
      return;
    }
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
      maximumSizeInBytes: MAX_BYTES,
      allowedContentTypes: ALLOWED_TYPES,
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
    const extSafe = extOf(name);
    if (!extSafe || !ALLOWED_EXT.has(extSafe)) {
      results.push({ name, ok: false, error: "type_not_allowed" });
      continue;
    }
    if (!Number.isFinite(f.size) || f.size <= 0) {
      results.push({ name, ok: false, error: "invalid_size" });
      continue;
    }
    if (f.size > MAX_BYTES) {
      results.push({ name, ok: false, error: "too_large" });
      continue;
    }
    // Strip the original extension from the sanitized base so it isn't doubled.
    const base = String(sanitize(f.name, i)).replace(/\.[^.\s]+$/, "");
    const key = `quotes/${ts}-${i}-${randomUUID().slice(0, 8)}-${base}.${extSafe}`;
    try {
      const presigned = await presignUrl(signed, {
        pathname: key,
        access: "public",
        operation: "put",
        maximumSizeInBytes: MAX_BYTES,
        allowedContentTypes: ALLOWED_TYPES,
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
