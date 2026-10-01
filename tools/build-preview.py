#!/usr/bin/env python3
"""Génère pages/<page>/preview.html : le bloc Drupal dans une coquille qui imite la page EPHEC (h1 + menu)."""
import pathlib, sys

page = sys.argv[1] if len(sys.argv) > 1 else "trouver-sa-voie"
title = sys.argv[2] if len(sys.argv) > 2 else "Trouver sa voie après la rhéto ou le secondaire"
d = pathlib.Path(__file__).resolve().parent.parent / "pages" / page
bloc = (d / "bloc.html").read_text(encoding="utf-8")

shell = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aperçu EPHEC</title>
<style>
  :root {{ --bg: #fff; --fg: #1d1d1d; }}
  html, body {{ margin: 0; background: var(--bg); color: var(--fg); color-scheme: light; }}
  body {{ font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
  .shell-bar {{ position: sticky; top: 0; z-index: 10; height: 64px; display: flex; align-items: center; justify-content: space-between;
               padding: 0 24px; background: #fff; border-bottom: 1px solid #eee; font-size: 14px; }}
  .shell-bar b {{ font-size: 20px; letter-spacing: .02em; }}
  .shell-note {{ color: #6b6b6b; }}
  main {{ padding: 0 24px; }}
  h1 {{ max-width: 1200px; margin: 40px auto 0; font-size: 15px; font-weight: 500; color: #6b6b6b; }}
  .ep-voie {{ --ep-voie-sticky-top: 64px !important; }}
  @media (max-width: 760px) {{ main {{ padding: 0 16px; }} .shell-note {{ display: none; }} }}
</style>
</head>
<body>
<div class="shell-bar"><b>EPHEC</b><span class="shell-note">Aperçu : simulation du menu et du titre Drupal</span></div>
<main>
<h1>{title}</h1>
{bloc}
</main>
</body>
</html>
"""
(d / "preview.html").write_text(shell, encoding="utf-8")
print(d / "preview.html")
