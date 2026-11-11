#!/usr/bin/env python3
"""Static checks for the GS3D site.

Runs without dependencies so CI stays fast. Catches the two failure modes that
have actually bitten this project: a build-breaking vercel.json and an asset or
link that only 404s once a page is opened.

    python3 tools/check-site.py
"""

import json
import pathlib
import re
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts)
problems = []

_ids_cache = {}


def ids_of(path):
    if path not in _ids_cache:
        _ids_cache[path] = set(re.findall(r'\sid="([^"]+)"', path.read_text(errors="ignore")))
    return _ids_cache[path]


def resolve(page, path_part):
    if path_part.startswith("/"):
        return (ROOT / path_part.lstrip("/")).resolve()
    return (page.parent / urllib.parse.unquote(path_part)).resolve()


def check_links(page):
    html = page.read_text(errors="ignore")
    for attr, val in re.findall(r'\s(src|href)="([^"]+)"', html):
        value = val.strip()
        if not value or value.startswith(("http://", "https://", "mailto:", "tel:", "#", "javascript:", "data:")):
            continue
        if re.search(r"[+{}]", value):  # JS template fragments, not files
            continue
        path_part, _, fragment = value.partition("#")
        path_part = path_part.split("?")[0]
        if not path_part:
            continue
        target = resolve(page, path_part)
        if not str(target).startswith(str(ROOT)):
            problems.append(f"{page.relative_to(ROOT)}: {value} -> resolves outside the site")
            continue
        if not target.exists():
            problems.append(f"{page.relative_to(ROOT)}: {value} -> missing file")
        elif fragment and target.suffix == ".html" and fragment not in ids_of(target):
            problems.append(f"{page.relative_to(ROOT)}: {value} -> missing anchor #{fragment}")


def check_config():
    path = ROOT / "vercel.json"
    if not path.exists():
        problems.append("vercel.json missing")
        return
    try:
        config = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        problems.append(f"vercel.json is not valid JSON: {exc}")
        return
    allowed = {
        "$schema", "buildCommand", "cleanUrls", "crons", "devCommand", "framework",
        "functions", "git", "headers", "images", "installCommand", "outputDirectory",
        "public", "redirects", "regions", "rewrites", "trailingSlash",
    }
    unknown = sorted(set(config) - allowed)
    if unknown:
        problems.append(f"vercel.json: unsupported top-level keys {unknown} (builds fail schema validation)")
    for rule in config.get("rewrites", []) + config.get("redirects", []):
        for key in ("source", "destination"):
            if key not in rule:
                problems.append(f"vercel.json rule missing '{key}': {rule}")


def check_canonicals():
    hosts = {}
    for page in PAGES:
        html = page.read_text(errors="ignore")
        for href in re.findall(r'<link rel="canonical" href="([^"]+)"', html):
            hosts.setdefault(urllib.parse.urlparse(href).netloc, []).append(page.relative_to(ROOT))
        for src in re.findall(r'property="og:(?:image|url)" content="([^"]+)"', html):
            if "og:image" not in src and not src.endswith((".jpg", ".png", ".webp")):
                continue
            local = ROOT / urllib.parse.urlparse(src).path.lstrip("/")
            if local.suffix and not local.exists():
                problems.append(f"{page.relative_to(ROOT)}: social image {src} has no local file")
    if len(hosts) > 1:
        detail = ", ".join(f"{host} ×{len(pages)}" for host, pages in hosts.items())
        problems.append(f"canonical host mismatch across pages: {detail}")


def check_manifest():
    path = ROOT / "manifest.webmanifest"
    if not path.exists():
        problems.append("manifest.webmanifest missing")
        return
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        problems.append(f"manifest.webmanifest is not valid JSON: {exc}")
        return
    for icon in data.get("icons", []):
        local = ROOT / icon.get("src", "").lstrip("/")
        if not local.exists():
            problems.append(f"manifest icon missing on disk: {icon.get('src')}")


def main():
    if not PAGES:
        print("no HTML pages found — wrong working directory?")
        return 1
    check_config()
    check_canonicals()
    check_manifest()
    for page in PAGES:
        check_links(page)
    if problems:
        print(f"{len(problems)} problem(s):")
        for problem in problems:
            print(" -", problem)
        return 1
    print(f"OK — {len(PAGES)} pages, links/assets/anchors valid, vercel.json and manifest valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
