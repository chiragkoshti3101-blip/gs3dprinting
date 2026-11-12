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

/**
 * Email the owner about a stored enquiry. Optional: with no RESEND_API_KEY the
 * site behaves exactly as before (record in blob, nothing else). Never throws —
 * a failed notification must not fail the enquiry itself.
 */
async function notifyOwner(record) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.ENQUIRY_NOTIFY_TO || "gs3dprinting@gmail.com";
  const from = process.env.ENQUIRY_NOTIFY_FROM || "GS3D Website <onboarding@resend.dev>";
  const form = record.form || {};
  const base = (process.env.PUBLIC_BASE_URL || "https://www.gs3dprinting.com").replace(/\/$/, "");
  const abs = (url) => (/^https?:\/\//i.test(url || "") ? url : base + (url || ""));
  const from_files = (record.files || []).map((f) => `${f.name}: ${abs(f.url)}`).join("\n") || "none";
  const text = [
    "New enquiry from the website",
    "",
    `Name: ${form.name || "-"}`,
    `Phone: ${form.phone || "-"}`,
    `Email: ${form.email || "-"}`,
    `Company: ${form.company || "-"}`,
    `Service: ${form.service || "-"}`,
    `Needed by: ${form.deadline || "-"}`,
    "",
    "Message:",
    form.message || "-",
    "",
    "Files:",
    from_files,
    "",
    `Record: ${record.id}`,
  ].join("\n");
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `New enquiry — ${form.name || "website"}`,
        text,
      }),
    });
    if (!resp.ok) {
      console.error("notify failed", resp.status, (await resp.text()).slice(0, 200));
    }
  } catch (err) {
    console.error("notify error", String(err?.message || err));
  }
}

export default async function handler(req, res) {
  const store = process.env.BLOB_STORE_ID || "store_QqMBiCBONsvyjsy0";

  // ---- POST: presign or record ----
  if (req.method === "POST") {
    let body;
    try { body = req.body; } catch { return res.status(400).json({ ok: false, error: "bad_body" }); }
    const op = String(body?.op || "");

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
            // Relative so it resolves on whatever host serves the page
            // (absolute cross-origin URLs are blocked by our img-src CSP).
            publicUrl: `/files/${key}`,
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
      res.status(200).json({ ok: true, records: out });
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
