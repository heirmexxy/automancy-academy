import glob, re, pathlib
s = pathlib.Path("src/hub.html").read_text()
css = (pathlib.Path("src/lesson.css").read_text() + pathlib.Path("src/platform.css").read_text()).replace(".q > p{font-weight:700}", ".q > p:first-child{font-weight:700}")
import json
sheets = {json.load(open(f))["id"]: json.load(open(f)) for f in sorted(glob.glob("src/sheets/*.json"))}
tpls = {}
for f in sorted(glob.glob("src/templates/*.json")):
    m = json.load(open(f))
    for it in m.get("items", []):
        it.setdefault("kind", "n8n")
        if it.get("file"):
            folder = "make" if it["kind"] == "make" else "wf"
            it["path"] = f"templates/{folder}/{it['file']}"
            it["wf"] = json.load(open("src/" + it["path"]))
    if m["id"] in tpls:
        tpls[m["id"]]["items"] += m.get("items", [])
    else:
        tpls[m["id"]] = m
js = pathlib.Path("src/lesson.js").read_text() + pathlib.Path("src/sb7.js").read_text() + pathlib.Path("src/videos.js").read_text() + "\nconst TPLS = " + json.dumps(tpls, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";\n" + "\nconst SHEETS = " + json.dumps(sheets, ensure_ascii=False).replace("</", "<\\/") + ";\n" + pathlib.Path("src/platform.js").read_text() + pathlib.Path("src/clips.js").read_text() + pathlib.Path("src/walk.js").read_text()
def rep(old, new, count=1):
    global s
    assert old in s, old[:60]
    s = s.replace(old, new, count)
rep("</style>", css + "\n</style>")
# The lesson link row now lives in src/hub.html (lessonLinkHTML in src/lesson.js).
# Keep this file in step with scripts/sync-course.mjs in the app, which assembles the same page in app mode.
rep("update();\n})();", js + "\nupdate();\nroute();\n})();")
mods = "\n".join(pathlib.Path(p).read_text() for p in sorted(glob.glob("src/modules/*.html")))
s = s.replace("<!--MODULES-->", mods)
pathlib.Path("flowforge.html").write_text(s)
m = re.findall(r"<script>(.*?)</script>", s, re.S)[0]
pathlib.Path("t.js").write_text(m)
print(len(s))
