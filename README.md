# GS3D Printing — website

Static marketing site for GS3D Printing (3D printing, industrial scale models,
rapid prototyping — Ahmedabad), plus two Vercel serverless functions for file
uploads and the enquiry inbox. No build step: the HTML, CSS and JS are served
as-is.

**Live:** https://gs3dprinting.com (Vercel project `gs3d-rebuild`)

## Layout

```
index.html                 Homepage: hero, 3D viewer, services, technologies,
                           process, project galleries, pricing, FAQ, quote form
services/*.html            Four service detail pages
terms.html/privacy.html     Legal pages
404.html                   Not-found page (Vercel serves this for unknown paths)
admin.html                 Password-gated enquiry inbox (/admin rewrites here)
api/inbox.js               POST presign|record, GET list (X-Admin-Pass header)
api/upload.js              POST presign only — bytes go browser → blob directly
assets/css/styles.css      Design tokens and all styles
assets/js/main.js          Nav, form, WhatsApp handoff, uploads
assets/js/gallery.js       Lightbox data for the project galleries
assets/js/scene3d.js       Three.js hero model (loads on scroll, WebGL fallback)
assets/img/…               Project photos, logos, social card, app icons
vercel.json                Security headers (CSP/HSTS) and rewrites
manifest.webmanifest       Installable-app metadata
tools/check-site.py        Link/asset/anchor/config checker (runs in CI)
```

## Local development

```bash
python3 -m http.server 4002        # static pages only
```

The two API routes need Vercel, so uploads and the inbox only work on a
deployment (or `vercel dev`). Pages, 3D viewer, galleries and the WhatsApp
handoff all work from the static server.

## Deploy

Pushing to `main` on GitHub (`chiragkoshti3101-blip/gs3dprinting`) triggers a
Vercel production deployment through the connected Git integration.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Required | Purpose |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | yes | Vercel Blob read/write for uploads and inbox records |
| `BLOB_STORE_ID` | yes | Blob store the functions write to |
| `ADMIN_PASSWORD` | yes | Gate for `GET /api/inbox` (sent as `X-Admin-Pass`) |
| `RESEND_API_KEY` | optional | Email the owner when an enquiry is recorded |
| `ENQUIRY_NOTIFY_TO` | optional | Recipient (default `gs3dprinting@gmail.com`) |
| `ENQUIRY_NOTIFY_FROM` | optional | Sender; must be a Resend-verified address |
| `PUBLIC_BASE_URL` | optional | Origin used in `/files/` links (default `https://gs3dprinting.com`) |

With no `RESEND_API_KEY` the site behaves exactly as before: the enquiry is
stored and visible in `/admin`, nothing is emailed. A failed notification never
fails the enquiry.

## Checks

```bash
python3 tools/check-site.py
```

Validates every internal `href`/`src` against disk, checks cross-page anchors and
`#fragment` targets, ensures all canonicals share one host and that the social
card and manifest icons exist, and rejects unsupported `vercel.json` keys (an
invalid key there fails the whole build). CI runs it on every push and PR via
`.github/workflows/site-check.yml`.

## Notes and gotchas

- **`vercel.json` schema is strict.** An unknown top-level key fails the build
  before any code runs. Use `.vercelignore` for exclusions, not a `files` array.
- **Hobby function body limit is 4.5 MB.** `api/upload.js` only presigns; file
  bytes travel from the browser straight to Blob storage.
- **`/files/:path*` rewrite** proxies the blob store and forces
  `Content-Disposition: inline`, so WhatsApp image links open instead of
  downloading. Do not remove it.
- **CSP lives in `vercel.json`**, not a meta tag. Adding a third-party script
  means updating `script-src` there.
- **Canonical host is `gs3dprinting.com`** everywhere. If the site is served from
  a different domain, update canonicals, `og:url`, `sitemap.xml` and
  `robots.txt` together — `tools/check-site.py` fails on a host mismatch.
