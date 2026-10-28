#!/usr/bin/env python3
"""Builds preview/index.html: the clickable preview, from the real app's CSS + public/hero photos."""
import base64, re, subprocess, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
css = (root / "src/app/globals.css").read_text()
# Artifact theming contract: dark tokens under guarded selectors + an explicit data-theme block.
m = re.search(r"@media \(prefers-color-scheme: dark\) \{\s*:root \{(.*?)\n  \}\n\}", css, re.S)
dark = m.group(1)
css = css.replace(m.group(0), "@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {" + dark + "\n  }\n}\n:root[data-theme=\"dark\"] {" + dark + "\n}")
def small(name):
    out = f"/tmp/{name}-small.jpg"
    subprocess.run(["python3", "-c", f"from PIL import Image;im=Image.open('{root}/public/hero/{name}.jpg');im.thumbnail((1100,1100));im.save('{out}',quality=74,optimize=True)"], check=True)
    return "data:image/jpeg;base64," + base64.b64encode(open(out, "rb").read()).decode()
html = (root / "scripts/preview.template.html").read_text()
html = html.replace("/*__CSS__*/", css).replace("__IMG1__", small("group")).replace("__IMG2__", small("dancing"))
(root / "preview/index.html").write_text(html)
print("wrote preview/index.html", len(html) // 1024, "KB")
