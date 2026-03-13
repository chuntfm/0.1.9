#!/usr/bin/env python3
"""Build script for chunt15.org static site."""

import json
import os
import shutil
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader


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


def build():
    # Read config
    with open(ROOT / "site.yaml") as f:
        config = yaml.safe_load(f)

    # Apply environment variable overrides
    apply_env_overrides(config)

    # Set up Jinja2
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)))
    template = env.get_template("index.html")

    # Build client config (exclude sensitive data like email)
    client_config = json.loads(json.dumps(config))
    if "links" in client_config and "email" in client_config["links"]:
        del client_config["links"]["email"]

    # Render HTML
    html = template.render(
        config=config,
        config_json=json.dumps(client_config, indent=2),
    )

    # Prepare dist
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    # Write HTML
    (DIST / "index.html").write_text(html)

    # Copy static assets
    if STATIC.exists():
        shutil.copytree(STATIC, DIST / "static")

    # Copy favicon to root for browser default requests
    favicon = STATIC / "images" / "favicon.ico"
    if favicon.exists():
        shutil.copy2(favicon, DIST / "favicon.ico")

    # Copy CNAME if present
    cname = ROOT / "CNAME"
    if cname.exists():
        shutil.copy2(cname, DIST / "CNAME")

    print(f"Built site to {DIST}")


if __name__ == "__main__":
    build()
