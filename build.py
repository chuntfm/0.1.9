#!/usr/bin/env python3
"""Build script for chunt15.org static site."""

import json
import os
import random
import re
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader

try:
    import rjsmin
except ImportError:
    rjsmin = None

try:
    import csscompressor
except ImportError:
    csscompressor = None


ROOT = Path(__file__).parent
DIST = ROOT / "dist"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"


def apply_env_overrides(config, prefix="SITE"):
    """Recursively override config values from environment variables.

    Convention: SITE__THEME__LIGHT__BG overrides config["theme"]["light"]["bg"].
    Double underscores separate nesting levels.
    """
    def _cast(env_val, original):
        if isinstance(original, bool):
            return env_val.lower() in ("true", "1", "yes")
        if isinstance(original, int):
            try:
                return int(env_val)
            except ValueError:
                return env_val
        if isinstance(original, float):
            try:
                return float(env_val)
            except ValueError:
                return env_val
        return env_val

    def _walk(d, parts):
        for key, value in d.items():
            current = parts + [key.upper()]
            env_key = "__".join(current)
            if isinstance(value, dict):
                _walk(value, current)
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, dict):
                        _walk(item, current + [str(i)])
                    else:
                        item_env = "__".join(current + [str(i)])
                        env_val = os.environ.get(item_env)
                        if env_val is not None:
                            value[i] = _cast(env_val, item)
            else:
                env_val = os.environ.get(env_key)
                if env_val is not None:
                    d[key] = _cast(env_val, value)

    _walk(config, [prefix])


def fetch_json(url, timeout=5):
    """Fetch and parse JSON from a URL. Returns parsed data or None on failure."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f"Warning: failed to fetch {url}: {e}")
        return None


def fetch_skegness_temperature(url):
    """Fetch current temperature from Open-Meteo. Returns celsius or None."""
    data = fetch_json(url)
    if data and "current" in data:
        return data["current"].get("temperature_2m")
    return None


def temperature_to_bg(temp_c, base_hex):
    """Map temperature to a light-mode background with a subtle pink tint.

    0C or below: base color unchanged.
    35C or above: max subtle warm pink shift (R+2, G-10, B-12).
    Linear interpolation in between.
    """
    base_hex = base_hex.lstrip("#")
    base_r, base_g, base_b = int(base_hex[0:2], 16), int(base_hex[2:4], 16), int(base_hex[4:6], 16)

    if temp_c is None or temp_c <= 0:
        return f"#{base_r:02x}{base_g:02x}{base_b:02x}"

    t = min(temp_c / 35.0, 1.0)
    r = min(round(base_r + 2 * t), 255)
    g = max(round(base_g - 10 * t), 0)
    b = max(round(base_b - 12 * t), 0)
    return f"#{r:02x}{g:02x}{b:02x}"


def minify_js(text):
    """Minify JavaScript if rjsmin is available."""
    if rjsmin:
        return rjsmin.jsmin(text)
    return text


def minify_css(text):
    """Minify CSS if csscompressor is available."""
    if csscompressor:
        return csscompressor.compress(text)
    return text


def generate_sitemap(config, pages):
    """Generate a sitemap.xml from the pages list."""
    site_url = config.get("site", {}).get("url", "").rstrip("/")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for page in pages:
        slug = page["slug"]
        loc = f"{site_url}/{slug + '/' if slug else ''}"
        lines.append(f"  <url><loc>{loc}</loc><lastmod>{now}</lastmod></url>")
    lines.append("</urlset>")
    return "\n".join(lines)


def build():
    # Check if minification is enabled (any non-empty MINIFY env var)
    do_minify = bool(os.environ.get("MINIFY", ""))

    # Read config
    with open(ROOT / "site.yaml") as f:
        config = yaml.safe_load(f)

    # Apply environment variable overrides
    apply_env_overrides(config)

    # Temperature-based light mode background
    temp_url = config.get("build", {}).get("temperature_url")
    temp = fetch_skegness_temperature(temp_url) if temp_url else None
    if temp is not None:
        base_bg = config["theme"]["light"]["bg"]
        print(f"Skegness temperature: {temp}C")
        config["theme"]["light"]["bg"] = temperature_to_bg(temp, base_bg)
    else:
        print("Skegness temperature: unavailable, using default bg")

    # Set up Jinja2
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)))

    # Resolve asset paths
    base_path = config.get("site", {}).get("base_path", "")
    assets_url = config.get("site", {}).get("assets_url", "")
    local = f"{base_path}/static"
    assets = assets_url if assets_url else local

    # Build client config (exclude sensitive data like email)
    client_config = json.loads(json.dumps(config))
    if "links" in client_config and "email" in client_config["links"]:
        del client_config["links"]["email"]

    config_json = json.dumps(client_config, indent=2)

    # Fetch archive data at build time
    archive_data = None
    archive_url = config.get("api", {}).get("mixcloud_archive")
    if archive_url:
        archive_data = fetch_json(archive_url)
        if archive_data is not None:
            archive_data.sort(
                key=lambda s: (s.get("info") or {}).get("date", ""),
                reverse=True,
            )

    # Pick a random quote for this build
    quotes = config.get("links", {}).get("quotes", [])
    random_quote = random.choice(quotes) if quotes else None

    # Prepare dist
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    # Render pages
    pages = config.get("pages", [])
    for page in pages:
        slug = page["slug"]
        template_path = page["template"]
        current_page = slug if slug != "" else "home"

        # Pass archive data only to the archive page
        extra = {}
        if slug == "archive" and archive_data is not None:
            extra["archive_data"] = archive_data

        html = env.get_template(template_path).render(
            config=config,
            config_json=config_json,
            current_page=current_page,
            random_quote=random_quote,
            **extra,
        )

        if slug == "":
            # Homepage
            (DIST / "index.html").write_text(html)
        else:
            # Subpage: dist/{slug}/index.html
            page_dir = DIST / slug
            page_dir.mkdir(parents=True, exist_ok=True)
            (page_dir / "index.html").write_text(html)

    # Render 404
    page_404 = env.get_template("404.html").render(
        config=config,
        config_json=config_json,
        current_page="404",
        random_quote=random_quote,
    )
    (DIST / "404.html").write_text(page_404)

    # Render CSS
    css = env.get_template("style.css").render(assets=assets)

    # Copy static assets
    if STATIC.exists():
        shutil.copytree(STATIC, DIST / "static")

    # Write rendered CSS (overwrites the copy from static)
    if do_minify:
        css = minify_css(css)
    (DIST / "static" / "css" / "style.css").write_text(css)

    # Minify JS files
    if do_minify:
        js_dir = DIST / "static" / "js"
        if js_dir.exists():
            for js_file in js_dir.glob("*.js"):
                js_file.write_text(minify_js(js_file.read_text()))

    # Generate sitemap
    sitemap = generate_sitemap(config, pages)
    (DIST / "sitemap.xml").write_text(sitemap)

    # Copy favicon to root for browser default requests
    favicon = STATIC / "images" / "web" / "favicons" / "favicon.ico"
    if favicon.exists():
        shutil.copy2(favicon, DIST / "favicon.ico")

    # Copy CNAME if present
    cname = ROOT / "CNAME"
    if cname.exists():
        shutil.copy2(cname, DIST / "CNAME")

    print(f"Built site to {DIST}")


if __name__ == "__main__":
    build()
