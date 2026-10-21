#!/usr/bin/env python3
"""Build the WhatsApp lesson scripts (docs/CONVENTIONS.md, "WhatsApp learning").

Reads   course-build/index.json, course-build/lessons/<fileId>.html,
        course/src/sb7.js, course/src/videos.js, course/src/clips.js
Writes  data/whatsapp/<fileId>.json, data/whatsapp/index.json,
        docs/whatsapp-scripts-sample.md (lessons 1.1 and 3.4 as they read in chat)

Python 3 standard library only.  Run:  python3 scripts/build_whatsapp_scripts.py
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://automancy.cc"
MAX = 1000
GUIDES = [("male", "Emeka"), ("female", "Miracle")]  # same order as COACH in course/src/platform.js
SAMPLE_IDS = ["1.1", "3.4"]

# ---------------------------------------------------------------- DOM ----
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr", "use"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs or {}), [], parent

    @property
    def cls(self):
        return (self.attrs.get("class") or "").split()

    def has(self, c):
        return c in self.cls

    def els(self):
        return [c for c in self.children if isinstance(c, Node)]

    def find_all(self, pred):
        out = []
        for c in self.els():
            if pred(c):
                out.append(c)
            out.extend(c.find_all(pred))
        return out

    def find(self, pred):
        for c in self.els():
            if pred(c):
                return c
            r = c.find(pred)
            if r is not None:
                return r
        return None

    def text(self):
        return "".join(c if isinstance(c, str) else c.text() for c in self.children)


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse(src):
    b = Builder()
    b.feed(src)
    b.close()
    return b.root


# ------------------------------------------------------------ helpers ----
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF⬀-⯿︎️‍⃣⌀-⏿]"
)
SKIP_TAGS = {"svg", "script", "style", "button", "select", "textarea", "input", "option", "template"}
CONTROLS = {"input", "select", "textarea", "button"}


def clean(s):
    s = EMOJI.sub("", s)
    s = re.sub(r"[ \t ]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r" +([,.;:!?)])(?=\s|$|[*_`\"'])", r"\1", s)
    s = re.sub(r"\( +", "(", s)
    return s.strip()


def plain(node):
    """Text only, whitespace collapsed (for options, names, labels)."""
    if isinstance(node, str):
        return clean(re.sub(r"\s+", " ", node))
    return clean(re.sub(r"\s+", " ", "".join(_plain_parts(node))))


def _plain_parts(n):
    for c in n.children:
        if isinstance(c, str):
            yield c
        elif c.tag not in SKIP_TAGS:
            yield from _plain_parts(c)


def wrap(mark, inner):
    lead = inner[: len(inner) - len(inner.lstrip())]
    trail = inner[len(inner.rstrip()):]
    core = inner.strip()
    if not core:
        return inner
    core = core.replace(mark, "") if mark in "*_" else core
    if not core.strip():
        return inner
    return f"{lead}{mark}{core}{mark}{trail}"


def inl(node, ctx=None):
    """Inline render with WhatsApp marks: *bold*, _italic_, `code`."""
    ctx = ctx or {}
    if isinstance(node, str):
        return re.sub(r"\s+", " ", EMOJI.sub("", node))
    t = node.tag
    if t in SKIP_TAGS or "hidden" in node.attrs:
        return ""
    if t == "br":
        return "\n"
    inner = "".join(inl(c, ctx) for c in node.children)
    if t in ("b", "strong"):
        if ctx.get("bold"):
            return inner
        inner = "".join(inl(c, dict(ctx, bold=True)) for c in node.children)
        return wrap("*", inner)
    if t in ("i", "em"):
        if ctx.get("bold") or ctx.get("ital"):
            return inner
        inner = "".join(inl(c, dict(ctx, ital=True)) for c in node.children)
        return wrap("_", inner)
    if t == "code":
        txt = plain(node)
        if ctx.get("bold") or ctx.get("ital") or not txt:
            return txt
        return f"`{txt}`"
    if t in ("ul", "ol"):
        return " " + "; ".join(inl(li, ctx).strip() for li in node.els() if li.tag == "li") + " "
    if t in ("p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"):
        return " " + inner + " "
    return inner


def line(node):
    return clean(inl(node))


def strip_marks(s):
    s = s.replace("*", "").replace("`", "")
    return re.sub(r"(?<![\w$])_|_(?![\w$])", "", s).strip()


def heading(text):
    return f"*{strip_marks(text)}*"


def has_controls(n):
    return n.find(lambda x: x.tag in CONTROLS) is not None


def speaker_from_svg(n):
    u = n.find(lambda x: x.tag == "use")
    if u is None:
        return ""
    h = u.attrs.get("href") or u.attrs.get("xlink:href") or ""
    return h.lstrip("#").capitalize()


def split_text(body, limit=MAX):
    """Split at paragraph, then line, then sentence boundaries."""
    body = body.strip()
    if len(body) <= limit:
        return [body]
    parts, cur = [], ""
    units = []
    for para in body.split("\n\n"):
        if len(para) <= limit:
            units.append(("\n\n", para))
            continue
        for ln in para.split("\n"):
            if len(ln) <= limit:
                units.append(("\n", ln))
                continue
            for sent in re.split(r"(?<=[.!?:;])\s+", ln):
                while len(sent) > limit:  # last resort: hard cut at a space
                    cut = sent.rfind(" ", 0, limit)
                    cut = cut if cut > 0 else limit
                    units.append((" ", sent[:cut]))
                    sent = sent[cut:].strip()
                units.append((" ", sent))
    for sep, u in units:
        if not cur:
            cur = u
        elif len(cur) + len(sep) + len(u) <= limit:
            cur += sep + u
        else:
            parts.append(cur)
            cur = u
    if cur:
        parts.append(cur)
    parts = [p.strip() for p in parts if p.strip()]
    # never leave a heading or a one-line intro on its own: pull lines forward from the next part
    i = 0
    while i < len(parts) - 1:
        if len(parts[i]) < 200:
            nxt = parts[i + 1].split("\n")
            moved = 0
            while moved < len(nxt) - 1 and len(parts[i]) + 1 + len(nxt[moved]) <= limit:
                cont = moved > 0 or (nxt[0].startswith("- ") and parts[i].split("\n")[-1].startswith("- "))
                parts[i] += ("\n" if cont else "\n\n") + nxt[moved]
                moved += 1
            parts[i + 1] = "\n".join(nxt[moved:]).strip()
        i += 1
    parts = [p for p in parts if p]
    # and never end on a short orphan (e.g. a table's last row): move lines back from the part before
    while len(parts) > 1 and len(parts[-1]) < 150:
        prev = parts[-2].split("\n")
        if len(prev) < 3 or len(prev[-1]) + 1 + len(parts[-1]) > limit or len(parts[-2]) - len(prev[-1]) < 300:
            break
        parts[-1] = prev[-1] + "\n" + parts[-1]
        parts[-2] = "\n".join(prev[:-1]).rstrip()
    return parts


# --------------------------------------------------------- block walk ----
# A "piece" is ("p", text) | ("code", where) | ("lab", name) | ("reveal", prompt, answer)
LAB_CLASSES = {"lab", "codelab", "jsonlab", "tokcalc", "dock", "dissect", "brain", "pager", "xsim", "router", "ident",
               "trace", "shield", "senti", "regress", "raglab", "prospect", "postlab", "msim", "msgstep", "memsim",
               "lookup", "incident", "inbox", "evalbox", "deliv", "calc"}
CONTAINERS = {"concept", "part", "step", "steps", "glitchlab", "mission", "prose", "why", "box", "takeaways"}
DATA_IGNORE = {"data-o", "data-ans", "data-opt", "data-why", "data-copy", "data-retry", "data-v", "data-pg", "data-mod"}


def is_lab(n):
    if n.tag not in ("div", "section", "form"):
        return False
    if n.has("sorter") or n.has("ready") or n.has("quiz") or n.has("logbox") or n.has("q"):
        return False
    if any(c in LAB_CLASSES for c in n.cls):
        return True
    if any(k.startswith("data-") and k not in DATA_IGNORE for k in n.attrs) and has_controls(n):
        return True
    if has_controls(n) and not any(c in CONTAINERS for c in n.cls):
        # controls inside an unknown wrapper; treat the wrapper as a lab only if it has no block children
        # of its own that are containers
        return not n.find(lambda x: any(c in CONTAINERS for c in x.cls))
    return False


def lab_name(n, ctx):
    if n.attrs.get("aria-label"):
        return plain(n.attrs["aria-label"])
    h = n.find(lambda x: x.tag in ("h4", "h5"))
    if h is not None and plain(h):
        return plain(h)
    return ctx.get("title") or "the interactive lab"


def table_rows(tbl, header=True, sep=" · "):
    lines = []
    head = tbl.find(lambda x: x.tag == "thead")
    if head is not None and header:
        hs = [plain(th) for th in head.find_all(lambda x: x.tag in ("th", "td"))]
        glitch = "#" in hs
        hs = [h for h in hs if h and h != "#"]
        if hs and not glitch:
            lines.append("_" + sep.join(hs) + "_")
    for sec in ("tbody", "tfoot"):
        for body in tbl.find_all(lambda x, s=sec: x.tag == s):
            for tr in body.els():
                if tr.tag != "tr":
                    continue
                cells = [line(td) for td in tr.els() if td.tag in ("td", "th")]
                cells = [c for c in cells if c]
                if not cells:
                    continue
                if len(cells) > 1 and re.fullmatch(r"[A-Z0-9]{1,2}", strip_marks(cells[0])):
                    lines.append(f"*{strip_marks(cells[0])}:* " + sep.join(cells[1:]))
                else:
                    first = cells[0]
                    if len(cells) > 1 and not re.search(r"[*_`\"“]", first) and len(first) <= 40:
                        first = f"*{strip_marks(first)}*"
                    lines.append("- " + sep.join([first] + cells[1:]))
    if not lines:  # table with rows directly under <table>
        for tr in tbl.find_all(lambda x: x.tag == "tr"):
            cells = [line(td) for td in tr.els() if td.tag in ("td", "th")]
            if any(cells):
                lines.append("- " + sep.join(c for c in cells if c))
    return "\n".join(lines)


def term_list(n):
    """<div><b>term</b>text</div>… → '- *term*: text'."""
    out = []
    for d in n.els():
        kids = [c for c in d.children if not (isinstance(c, str) and not c.strip())]
        if not kids:
            continue
        first = kids[0]
        if isinstance(first, Node) and first.tag in ("b", "strong", "i"):
            term = plain(first)
            rest = clean("".join(inl(c) for c in kids[1:]))
            out.append(f"- *{term}*: {rest}" if rest else f"- *{term}*")
        else:
            out.append("- " + line(d))
    return "\n".join(out)


def is_term_list(n):
    kids = n.els()
    return len(kids) >= 2 and all(
        k.tag == "div" and k.els() and k.els()[0].tag in ("b", "strong", "i")
        and (k.children[0] is k.els()[0] or (isinstance(k.children[0], str) and not k.children[0].strip()))
        for k in kids)


def list_text(n, depth=0):
    out, i = [], 0
    for li in n.els():
        if li.tag != "li":
            continue
        i += 1
        nested = [c for c in li.els() if c.tag in ("ul", "ol")]
        own = Node("li")
        own.children = [c for c in li.children if not (isinstance(c, Node) and c.tag in ("ul", "ol"))]
        txt = line(own)
        mark = f"{i}. " if n.tag == "ol" else "- "
        if n.tag == "ol" and re.match(r"\*[A-Z0-9]{1,2}:\*", txt):
            mark = ""  # glitch answers already carry their letter
        out.append("  " * depth + f"{mark}{txt}")
        for sub in nested:
            out.append(list_text(sub, depth + 1))
    return "\n".join(out)


def pieces(n, ctx):
    """Walk a block element and return pieces."""
    out = []
    for c in n.children:
        if isinstance(c, str):
            t = clean(c)
            if t:
                out.append(("p", t))
            continue
        out.extend(block(c, ctx))
    return merge_inline(out)


def merge_inline(ps):
    return [p for p in ps if not (p[0] == "p" and not p[1].strip())]


def block(c, ctx):
    t, cls = c.tag, c.cls
    if t in SKIP_TAGS or "hidden" in c.attrs:
        return []
    if t == "#comment":
        return []
    if c.has("res") or (c.has("box") and c.find(lambda x: x.has("res"))):
        return []  # "Go deeper" resource lists stay in the app
    if c.has("fb") or c.has("qscore") or c.has("facil") or c.has("num") or c.has("kicker") or c.has("outcomes"):
        return []
    if t == "pre":
        return [("code", ctx.get("title"))]
    if t in ("p", "h5", "h6", "label", "span", "a", "b", "strong", "i", "em", "small", "code"):
        txt = line(c)
        if t in ("h5", "h6") and txt:
            txt = heading(txt)
        return [("p", txt)] if txt else []
    if t in ("h2", "h3", "h4"):
        txt = line(c)
        return [("p", heading(txt))] if txt else []
    if t in ("ul", "ol"):
        return [("p", list_text(c))]
    if t == "table":
        return [("p", table_rows(c))]
    if t == "details":
        summ = c.find(lambda x: x.tag == "summary")
        body = Node("div")
        body.children = [x for x in c.children if x is not summ]
        ans = join_pieces(pieces(body, ctx), code_note="(The code is on screen in the app.)")
        return [("reveal", plain(summ) if summ is not None else "Reveal", ans)] if ans else []
    if t == "figure":
        if ctx.get("diagrams"):
            svg = c.find(lambda x: x.tag == "svg")
            lab = plain(svg.attrs.get("aria-label", "")) if svg is not None else ""
            cap = c.find(lambda x: x.tag == "figcaption")
            capt = line(cap) if cap is not None else ""
            capt = re.sub(r"^Scroll sideways on a phone\.\s*", "", capt)
            txt = "\n\n".join(x for x in [f"_The diagram, in words:_ {lab}" if lab else "", capt] if x)
            return [("p", txt)] if txt else []
        return []
    if c.has("say"):
        b = c.find(lambda x: x.has("bubble"))
        txt = line(b if b is not None else c)
        who = speaker_from_svg(c)
        if who and not strip_marks(txt).lower().startswith(who.lower()):
            txt = f"*{who}:* {txt}"
        return [("p", txt)]
    if c.has("insight"):
        who = speaker_from_svg(c)
        txt = clean(" ".join(line(p) for p in c.els() if p.tag != "svg"))
        if who and not strip_marks(txt).lower().startswith(who.lower()):
            txt = f"*{who}:* {txt}"
        return [("p", txt)]
    if c.has("cap"):
        return [("p", caption(c))]
    if c.has("urlparts"):
        rows = []
        for s in c.els():
            lab = s.find(lambda x: x.tag == "i")
            val = clean("".join(plain(x) if isinstance(x, Node) else x for x in s.children if x is not lab))
            rows.append(f"- *{plain(lab)}*: {val}" if lab is not None else f"- {val}")
        intro = plain(c.attrs.get("aria-label", ""))
        return [("p", (f"_{intro}:_\n" if intro else "") + "\n".join(rows))]
    if c.has("stats"):
        rows = []
        for s in c.els():
            b = s.find(lambda x: x.tag == "b")
            sp = s.find(lambda x: x.tag == "span")
            if b is not None and plain(b) not in ("", "–"):
                rows.append(f"- *{plain(b)}* {plain(sp) if sp is not None else ''}".rstrip())
        return [("p", "\n".join(rows))] if rows else []
    if c.has("ready"):
        return [("p", checklist(c)), ("lab", "the readiness check (tick it off for your score)")]
    if c.has("sorter"):
        return sorter(c)
    if c.has("vocab") or (t == "div" and is_term_list(c)):
        return [("p", term_list(c))]
    if c.has("analogy"):
        return [("p", line(c))]
    if c.has("tablewrap"):
        tbl = c.find(lambda x: x.tag == "table")
        if tbl is not None and has_controls(c):
            return [("lab", ctx.get("title") or "the interactive table")]
        return [("p", table_rows(tbl))] if tbl is not None else []
    if is_lab(c):
        return [("lab", lab_name(c, ctx))]
    if c.has("logbox"):
        return []
    # generic container
    return pieces(c, ctx)


def caption(c):
    b = c.find(lambda x: x.tag == "b")
    who = plain(b) if b is not None else ""
    rest = clean("".join(inl(x) for x in c.children if x is not b))
    if not who:
        return rest
    return f"*{who}:* {rest}"


def checklist(n):
    out = []
    for c in n.els():
        if c.tag in ("h5", "h4"):
            out.append(("\n" if out else "") + heading(plain(c)))
        elif c.tag == "label":
            must = c.find(lambda x: x.has("must"))
            txt = clean("".join(inl(x) for x in c.children if x is not must))
            out.append(f"- {txt}" + (" _(must)_" if must is not None else ""))
    return "\n".join(out)


def sorter(n):
    items = [s for s in n.els() if s.has("sitem")]
    letters = "ABCDEFGHIJKLMNOP"
    qs, ans = [], []
    for i, s in enumerate(items):
        sp = s.find(lambda x: x.tag == "span")
        txt = line(sp) if sp is not None else line(s)
        opts = [plain(b) for b in s.find_all(lambda x: x.tag == "button")]
        qs.append(f"*{letters[i]}.* {txt}")
        a = s.attrs.get("data-ans", "")
        ans.append(f"*{letters[i]}:* {a.capitalize()}")
    choice = ""
    if items:
        opts = [plain(b) for b in items[0].find_all(lambda x: x.tag == "button")]
        if opts:
            choice = " or ".join(opts)
    out = [("p", ("_Decide for each one: " + choice + "?_\n\n" if choice else "") + "\n".join(qs))]
    out.append(("reveal", "Reveal the answers", "\n".join(ans)))
    return out


def join_pieces(ps, code_note="(Code example on screen in the app.)"):
    out = []
    for p in ps:
        if p[0] == "p":
            out.append(p[1])
        elif p[0] == "code":
            if not out or out[-1] != f"_{code_note}_":
                out.append(f"_{code_note}_")
        elif p[0] == "lab":
            out.append(f"_(Interactive in the app: {p[1]}.)_")
        elif p[0] == "reveal":
            out.append(f"_{p[1]}:_\n{p[2]}")
    return clean("\n\n".join(x for x in out if x))


# --------------------------------------------------------- card maker ----
class Script:
    def __init__(self, item, url):
        self.item, self.url, self.cards = item, url, []
        self.code_scope_done = False

    def text(self, body):
        body = clean(body)
        if not body:
            return
        for part in split_text(body):
            self.cards.append({"t": "text", "body": part})

    def link(self, body):
        self.cards.append({"t": "link", "body": clean(body), "url": self.url})

    def code_link(self, where=None):
        w = f" ({strip_marks(where)})" if where else ""
        self.link(f"Code example on screen{w}: open it in the app.")

    def lab_link(self, name):
        self.link(f"Hands-on lab: {strip_marks(name)}. It's interactive, so open it in the app and try it there.")

    def reveal(self, prompt, answer):
        prompt, answer = clean(prompt), clean(answer)
        chunks = split_text(answer)
        for i, ch in enumerate(chunks):
            p = prompt if len(chunks) == 1 else f"{prompt} ({i + 1}/{len(chunks)})"
            self.cards.append({"t": "reveal", "prompt": p, "answer": ch})

    def emit(self, ps, head=None, code_once=True, where=None):
        """Turn pieces into cards: text runs are merged, code/lab become link cards, details become reveals."""
        buf = [head] if head else []
        code_done = False

        def flush():
            nonlocal buf
            if buf:
                self.text("\n\n".join(buf))
            buf = []

        for p in ps:
            if p[0] == "p":
                buf.append(p[1])
            elif p[0] == "code":
                if code_once and code_done:
                    if not buf or buf[-1] != "_(Code on screen in the app.)_":
                        buf.append("_(Code on screen in the app.)_")
                    continue
                flush()
                self.code_link(where or p[1])
                code_done = True
            elif p[0] == "lab":
                flush()
                self.lab_link(p[1])
            elif p[0] == "reveal":
                flush()
                self.reveal(p[1], p[2])
        flush()
        return code_done


# ------------------------------------------------------------ sections ---
def sec_tag(s):
    t = s.find(lambda x: x.has("tag"))
    return plain(t) if t is not None else ""


def sec_h2(s):
    ph = s.find(lambda x: x.has("part-h"))
    h = ph.find(lambda x: x.tag == "h2") if ph is not None else None
    return line(h) if h is not None else ""


def body_nodes(s):
    return [c for c in s.children if not (isinstance(c, Node) and c.has("part-h"))]


def as_node(children):
    n = Node("div")
    n.children = children
    return n


def lesson_url(item):
    i = item["id"]
    if i.startswith("B"):
        return f"{SITE}/learn#boss-{i[1:]}"
    return f"{SITE}/learn#m-{i.replace('.', '-')}"


def label_for(item):
    if item["kind"] == "boss":
        return item["title"].split(":")[0]  # "Boss 3"
    if item["kind"] == "capstone":
        return f"Capstone {item['id']}"
    return f"Lesson {item['id']}"


def build_item(item, idx, order, src, sb7, videos, clips):
    root = parse(src)
    art = root.find(lambda x: x.tag == "article")
    url = lesson_url(item)
    sc = Script(item, url)
    voice, guide = GUIDES[idx % 2]
    kind = item["kind"]
    iid = item["id"]

    # ---- opening
    hdr = art.find(lambda x: x.has("lh"))
    pills = [plain(p) for p in hdr.find_all(lambda x: x.has("pill"))] if hdr is not None else []
    dur = pills[0] if pills else ""
    dur = dur if dur.startswith("≈") else ("≈ " + dur if dur else "")
    lede = art.find(lambda x: x.has("lede"))
    head = "*" + (item["title"] if kind == "boss" else f"{label_for(item)} · {item['title']}") + "*"
    lines = [head, f"_{dur} · with {guide}_" if dur else f"_with {guide}_"]
    if lede is not None:
        lines.append(line(lede))
    if iid in sb7:
        after = {"boss": "After this boss", "capstone": "After the capstone"}.get(kind, "After this lesson")
        prob, plan, aft = sb7[iid]
        lines.append(f"*Your problem:* {prob}\n*The plan:* {plan}\n*{after}:* {aft}")
    sc.text("\n\n".join(lines))

    vid = videos.get(iid)
    item_clips = clips.get(iid, [])
    demo_idx = [n for n, c in enumerate(item_clips) if re.search(r"\bdemo\b", c.get("title", ""), re.I)]
    setup_idx = [n for n in range(len(item_clips)) if n not in demo_idx]
    state = {"video_done": False, "boss_steps": [], "curve": [], "curve_answers": None, "rubric_seen": False,
             "mission_h2": "", "pending_tasks": []}

    def add_videos():
        if state["video_done"]:
            return
        state["video_done"] = True
        if vid:
            title, channel, yt, look = vid
            ch = f" ({channel})" if channel else ""
            what = "this build" if kind != "lesson" else "this lesson's build"
            cap = (f"*Watch it built.* The animated walkthrough shows {what} step by step.\n\n"
                   f"Featured video: _{title}_{ch}.\nLook for: {look}")
            sc.cards.append({"t": "video", "caption": clean(cap), "media": f"walk:{iid}",
                             "youtube": f"https://www.youtube.com/watch?v={yt}", "app": url})
        else:
            sc.cards.append({"t": "video", "caption": "*Watch it built.* The animated walkthrough shows the build step by step.",
                             "media": f"walk:{iid}", "youtube": None, "app": url})
        for n in setup_idx:
            add_clip(n)

    def add_clip(n):
        c = item_clips[n]
        who = "Emeka" if c.get("presenter") == "male" else "Miracle"
        end = c.get("end") or ""
        cap = f"*Short clip:* {c['title']}, with {who}." + (f"\n\n{end}" if end else "")
        sc.cards.append({"t": "video", "caption": clean(cap), "media": f"clip:{iid}:{n}", "youtube": None, "app": url})

    sections = [s for s in art.els() if s.tag == "section"]
    # bosses: grab curveball answers from the reference section first
    for s in sections:
        if re.match(r"REFERENCE", sec_tag(s)):
            for d in s.find_all(lambda x: x.tag == "details"):
                summ = d.find(lambda x: x.tag == "summary")
                if summ is not None and "curveball" in plain(summ).lower():
                    ol = d.find(lambda x: x.tag == "ol")
                    if ol is not None:
                        state["curve_answers"] = [line(li) for li in ol.els() if li.tag == "li"]

    has_watch = any(re.search(r"\bWatch\b", sec_h2(s)) for s in sections)

    for s in sections:
        tag, h2 = sec_tag(s), sec_h2(s)
        nodes = body_nodes(s)
        content = as_node(nodes)
        ctx = {"title": h2}

        if content.find(lambda x: x.has("comic")):  # ---- story
            caps = [caption(c) for c in content.find_all(lambda x: x.has("cap"))]
            sc.text("\n\n".join([heading(h2)] + caps))
            continue

        if re.search(r"\bWatch\b", h2):  # ---- featured video + setup clips go here (lessons)
            add_videos()
            continue

        def concept(c):
            h3 = c.find(lambda x: x.tag == "h3")
            title = line(h3) if h3 is not None else h2
            inner = [x for x in c.children if not (isinstance(x, Node) and (x.has("num") or x is h3))]
            sc.emit(pieces(as_node(inner), {"title": title}), head=heading(title), where=None)

        if content.find(lambda x: x.has("takeaways")):  # ---- takeaways (+ course-complete card in 6.4)
            for n in demo_idx:
                add_clip(n)
            demo_idx = []
            for c in nodes:
                if not isinstance(c, Node):
                    continue
                if c.has("takeaways"):
                    h3 = c.find(lambda x: x.tag in ("h3", "h4"))
                    ol = c.find(lambda x: x.tag in ("ol", "ul"))
                    sc.text(heading(plain(h3) if h3 is not None else "Remember this") + "\n\n" + (list_text(ol) if ol is not None else ""))
                elif c.has("concept"):
                    concept(c)
                else:
                    sc.emit(block(c, ctx))
            continue

        if content.find(lambda x: x.has("concept") and x.find(lambda y: y.tag == "h3")):  # ---- concept cards
            for c in nodes:
                if isinstance(c, str):
                    continue
                if c.has("concept"):
                    concept(c)
                else:
                    sc.emit(block(c, ctx))
            continue

        if content.find(lambda x: x.has("steps")):  # ---- guided build / boss mission
            if not has_watch:
                add_videos()
            steps_parent = content.find(lambda x: x.has("steps"))
            boss_mission = "MISSION" in tag
            code_done = False
            before, after = [], []
            seen = False
            for c in nodes:
                if isinstance(c, Node) and c.has("steps"):
                    seen = True
                    continue
                if isinstance(c, Node):
                    (after if seen else before).append(c)
            pre = pieces(as_node(before), ctx)
            if boss_mission:
                state["mission_h2"] = h2
                sc.emit(pre, head="*Your mission: " + strip_marks(h2) + "*\n\nWork through the deliverables in order. Each one has its own message below.")
            else:
                sc.emit(pre, head=heading(h2))
            n = 0
            for st in steps_parent.els():
                if not st.has("step"):
                    continue
                n += 1
                h4 = st.find(lambda x: x.tag == "h4")
                title = line(h4) if h4 is not None else f"Step {n}"
                if boss_mission:
                    state["boss_steps"].append(strip_marks(title))
                    head = heading(title)
                else:
                    head = f"*Step {n} · {strip_marks(title)}*"
                inner = st.els()[0] if len(st.els()) == 1 and st.els()[0].tag == "div" else st
                kids = [x for x in inner.children if x is not h4]
                ps = pieces(as_node(kids), {"title": title})
                # one code link card per build: later code blocks become a short note
                out = []
                for p in ps:
                    if p[0] == "code" and code_done:
                        out.append(("p", "_(Code on screen in the app.)_"))
                    else:
                        if p[0] == "code":
                            code_done = True
                        out.append(p)
                sc.emit(out, head=head, code_once=True)
            post = []
            for c in after:
                if c.has("logbox"):
                    intro = c.find(lambda x: x.tag == "p")
                    txt = line(intro) if intro is not None else "The test list"
                    post.append(("p", "__LINK__" + txt))
                else:
                    post.extend(block(c, ctx))
            run = []
            for p in post + [("end",)]:
                if p[0] == "end" or (p[0] == "p" and p[1].startswith("__LINK__")):
                    sc.emit(run)
                    run = []
                    if p[0] != "end":
                        sc.link(p[1][8:].rstrip(".") + ". The full list is on screen in the app, ready to copy.")
                else:
                    run.append(p)
            continue

        if content.find(lambda x: x.has("glitchlab")):  # ---- glitch hunt / curveballs
            gl = content.find(lambda x: x.has("glitchlab"))
            curve = "CURVEBALL" in tag
            if curve:
                intro = [line(x.find(lambda y: y.has("bubble")) or x) for x in gl.els() if x.has("say")]
                det = [d for d in gl.els() if d.tag == "details"]
                head = heading("Glitch's curveballs: " + strip_marks(h2).lower())
                txt = [head] + [("*Glitch:* " + i if not i.startswith("*") else i) for i in intro]
                ans = state["curve_answers"] or []
                if ans and len(ans) == len(det):
                    txt.append("Think each one through when you reach that phase, then tap Reveal to compare with the reference answer.")
                    sc.text("\n\n".join(txt))
                    for d, a in zip(det, ans):
                        summ = d.find(lambda x: x.tag == "summary")
                        body = as_node([x for x in d.children if x is not summ])
                        q = join_pieces(pieces(body, ctx))
                        sc.reveal(f"*{plain(summ)}*\n{q}", a)
                else:
                    for d in det:
                        summ = d.find(lambda x: x.tag == "summary")
                        body = as_node([x for x in d.children if x is not summ])
                        txt.append(f"*{plain(summ)}*\n{join_pieces(pieces(body, ctx))}")
                    sc.text("\n\n".join(txt))
                    if ans:
                        sc.reveal("Reference answers to the curveballs", "\n".join(f"{i + 1}. {a}" for i, a in enumerate(ans)))
            else:
                ps = pieces(gl, ctx)
                reveals = [p for p in ps if p[0] == "reveal"]
                rest = [p for p in ps if p[0] != "reveal"]
                head = heading(h2 if h2 else "Glitch hunt")
                sc.emit(rest, head=head)
                for r in reveals:
                    prompt = r[1]
                    if re.match(r"reveal", prompt, re.I):
                        prompt = "Made your call on each one? Tap Reveal to check."
                    sc.reveal(prompt, r[2])
            continue

        if content.find(lambda x: x.has("mission")):  # ---- missions
            for m in content.find_all(lambda x: x.has("mission")):
                mission_card(sc, m, kind)
            continue

        if content.find(lambda x: x.has("quiz")):  # ---- quiz
            for q in content.find_all(lambda x: x.has("q") and x.attrs.get("data-ans") is not None):
                sc.cards.append(quiz_card(q, iid))
            continue

        if tag == "SCORING":
            sc.emit(pieces(content, ctx), head=heading(h2))
            if kind == "boss":
                boss_task(sc, item, state, url)
            continue

        if re.match(r"REFERENCE", tag):
            say = content.find(lambda x: x.has("say"))
            extra = (block(say, ctx)[0][1] + "\n\n") if say is not None else ""
            sc.link(extra + f"*{strip_marks(h2)}.* The reference build (code, examples and answers) is in the app. Open it once your own build is done.")
            continue


        if content.find(lambda x: x.has("logbox")) and not content.find(lambda x: x.has("steps")):
            continue  # proof-of-work log template: lives in the app

        # ---- anything else (client brief, architecture, playground, try-it, go-live / handover checks)
        diag = bool(re.search(r"ARCHITECTURE|BLUEPRINT", tag))
        ps = pieces(content, dict(ctx, diagrams=diag))
        sc.emit(ps, head=heading(h2) if h2 else None)

    if not state["video_done"]:
        add_videos()
    for n in demo_idx:
        add_clip(n)

    # ---- done
    pos = [o["id"] for o in order].index(iid)
    nxt = order[pos + 1] if pos + 1 < len(order) else None
    short = item["title"].split(": ", 1)[1] if kind == "boss" and ": " in item["title"] else item["title"]
    done = f"*{label_for(item)} complete!* _{short}_ is done and saved to your progress, on WhatsApp and in the app."
    if nxt:
        done += f"\n\nNext up: {label_for(nxt)}, _{nxt['title']}_."
    else:
        done += "\n\nThat's the whole course. Well done: you built it all."
    sc.cards.append({"t": "done", "body": clean(done)})
    return sc.cards


def mission_card(sc, m, kind):
    tier_el = m.find(lambda x: x.has("tier"))
    tier = "b"
    for c in (tier_el.cls if tier_el is not None else []):
        if c.startswith("t-"):
            tier = c[2:]
    names = {"b": "Bronze", "s": "Silver", "g": "Gold"}
    tier_txt = plain(tier_el) if tier_el is not None else ""
    xp = re.search(r"\+\d+ XP", tier_txt)
    h4 = m.find(lambda x: x.tag == "h4")
    title = plain(h4) if h4 is not None else names.get(tier, "Mission")
    if kind == "capstone" and "CAPSTONE" in tier_txt.upper():
        tier, label = "capstone", "The Capstone"
    else:
        label = names.get(tier, "Mission")
    task_lines, done_lines, extra = [], [], []
    seen_crit = False
    for c in m.els():
        if c is tier_el or c is h4:
            continue
        if c.has("crit"):
            seen_crit = True
            continue
        if c.tag in ("ul", "ol"):
            (done_lines if seen_crit else task_lines).append(list_text(c))
        elif c.tag == "details":
            summ = c.find(lambda x: x.tag == "summary")
            body = as_node([x for x in c.children if x is not summ])
            extra.append(("reveal", plain(summ), join_pieces(pieces(body, {}))))
        else:
            for p in block(c, {"title": title}):
                (done_lines if seen_crit else task_lines).append(p[1] if p[0] == "p" else
                                                                  "_(Details on screen in the app.)_")
    body = "\n\n".join(task_lines)
    if done_lines:
        body += "\n\n*Done when:*\n" + "\n".join(done_lines)
    body = clean(body)
    if len(body) > MAX:  # move the task detail into a text card, keep the criteria with the task
        sc.text(f"*{label} mission · {title}*\n\n" + "\n\n".join(task_lines))
        body = clean("The details are in the message above.\n\n*Done when:*\n" + "\n".join(done_lines))
    t = f"{label}" + (f" ({xp.group(0)})" if xp else "") + f": {title}"
    sc.cards.append({"t": "task", "tier": tier, "title": clean(t), "body": body})
    for r in extra:  # troubleshooting / notes for the mission, after the task
        sc.reveal(r[1], r[2])


def boss_task(sc, item, state, url):
    steps = state["boss_steps"]
    body = f"Build {strip_marks(state['mission_h2']).lower() or 'every deliverable'}:\n" + "\n".join(f"- {s}" for s in steps)
    body += ("\n\nScore 80 or more on the rubric to win. Send your links (documents, sheets, workflow exports, "
             "demo video: whatever your deliverables are) and a short write-up of each one.\n\n"
             "The full brief and rubric are in the app: " + url)
    body = clean(body)
    if len(body) > MAX:
        body = clean(body[: MAX - 1].rsplit("\n", 1)[0])
    sc.cards.append({"t": "task", "tier": "boss", "title": clean(item["title"]), "body": body})


def quiz_card(q, iid):
    ans = q.attrs.get("data-ans")
    qp = q.find(lambda x: x.tag == "p" and not x.has("fb"))
    text = re.sub(r"^\d+\.\s*", "", line(qp)) if qp is not None else ""
    btns = q.find_all(lambda x: x.tag == "button" and x.attrs.get("data-opt") is not None)
    opts = [plain(b) for b in btns]
    keys = [b.attrs.get("data-opt") for b in btns]
    fb = q.find(lambda x: x.has("fb"))
    why = plain(fb.attrs.get("data-why", "")) if fb is not None else ""
    if ans not in keys:
        raise ValueError(f"{iid}: quiz answer {ans!r} not among {keys}")
    return {"t": "quiz", "q": clean(text), "options": opts, "answer": keys.index(ans), "why": clean(why)}


# ------------------------------------------------------------ sources ---
def load_js_object(path, name):
    src = open(path, encoding="utf-8").read()
    m = re.search(r"const\s+" + name + r"\s*=\s*\{", src)
    if not m:
        raise SystemExit(f"{name} not found in {path}")
    out = {}
    for km in re.finditer(r'^"([^"]+)":(\[.*\]),?\s*$', src[m.end():], re.M):
        out[km.group(1)] = json.loads(km.group(2))
    return out


def load_clips():
    p = os.path.join(ROOT, "course-build", "data", "clips.json")
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    print("warning: course-build/data/clips.json missing; no clip cards", file=sys.stderr)
    return {}


# ----------------------------------------------------------- validate ---
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
PHONE = re.compile(r"\+?\d[\d \-]{9,}\d")
KEY = re.compile(r"\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}|\bsk-[A-Za-z0-9]{16,}|\bAIza[0-9A-Za-z_-]{20,}|\bxox[bp]-[0-9A-Za-z-]{10,}")


def validate(fid, data, source=""):
    """source: the lesson HTML; emails/phones are allowed only if the lesson itself uses them (placeholders)."""
    errs = []
    src_digits = re.sub(r"\D", "", source)
    cards = data["cards"]
    allowed = {
        "text": {"body"}, "video": {"caption", "media", "youtube", "app"},
        "quiz": {"q", "options", "answer", "why"}, "reveal": {"prompt", "answer"},
        "task": {"tier", "title", "body"}, "link": {"body", "url"}, "done": {"body"},
    }
    for i, c in enumerate(cards):
        t = c.get("t")
        where = f"{fid} card {i} ({t})"
        if t not in allowed:
            errs.append(f"{where}: unknown type")
            continue
        if set(c) - {"t"} != allowed[t]:
            errs.append(f"{where}: fields {sorted(set(c) - {'t'})} != {sorted(allowed[t])}")
        for k, v in c.items():
            if k in ("t", "answer", "options", "media", "youtube", "app", "url", "tier"):
                continue
            if not isinstance(v, str) or not v.strip():
                errs.append(f"{where}: empty {k}")
            elif len(v) > MAX:
                errs.append(f"{where}: {k} is {len(v)} chars")
        strings = [v for v in c.values() if isinstance(v, str)] + list(c.get("options", []))
        for s in strings:
            if EMOJI.search(s):
                errs.append(f"{where}: emoji left: {EMOJI.findall(s)}")
            for e in EMAIL.finditer(s):
                addr = e.group(0)
                if addr not in source and not re.search(r"\.example$|@example\.(com|org)$", addr):
                    errs.append(f"{where}: real-looking email {addr}")
            for ph in PHONE.finditer(s):
                digits = re.sub(r"\D", "", ph.group(0))
                if len(digits) >= 10 and digits not in src_digits and not re.search(r"0000000", digits) \
                        and not re.fullmatch(r"\d{4}-\d\d-\d\d \d\d", ph.group(0)):
                    errs.append(f"{where}: phone-like number {ph.group(0)}")
            if KEY.search(s):
                errs.append(f"{where}: key-like string {KEY.search(s).group(0)}")
        if t == "video":
            if not (c["media"] is None or re.fullmatch(r"(walk:[\w.]+|clip:[\w.]+:\d+)", c["media"])):
                errs.append(f"{where}: bad media {c['media']}")
            if c["youtube"] is not None and not c["youtube"].startswith("https://www.youtube.com/watch?v="):
                errs.append(f"{where}: bad youtube")
            if not c["app"].startswith(SITE):
                errs.append(f"{where}: bad app url")
        if t == "quiz":
            o = c["options"]
            if not (2 <= len(o) <= 4) or not all(isinstance(x, str) and x.strip() for x in o):
                errs.append(f"{where}: {len(o)} options")
            if not isinstance(c["answer"], int) or not (0 <= c["answer"] < len(o)):
                errs.append(f"{where}: bad answer {c['answer']}")
        if t == "task" and c["tier"] not in ("b", "s", "g", "boss", "capstone"):
            errs.append(f"{where}: bad tier {c['tier']}")
        if t == "link" and not c["url"].startswith(SITE):
            errs.append(f"{where}: bad link url")
    dones = [i for i, c in enumerate(cards) if c.get("t") == "done"]
    if dones != [len(cards) - 1]:
        errs.append(f"{fid}: done cards at {dones}, expected exactly one at the end")
    return errs


# ------------------------------------------------------------- sample ---
def render_sample(data):
    out = [f"## {data['id']} · {data['title']}", "",
           f"Track {data['track']} · {'free' if data['free'] else 'paid'} · voice: {data['voice']} · {len(data['cards'])} messages", ""]
    for i, c in enumerate(data["cards"], 1):
        t = c["t"]
        if t == "text":
            out += [f"**{i} · text**", "", "```text", c["body"], "```"]
        elif t == "link":
            out += [f"**{i} · link** (button: Open in the app → {c['url']})", "", "```text", c["body"], "```"]
        elif t == "video":
            out += [f"**{i} · video** · media `{c['media']}` · YouTube {c['youtube'] or '–'} · app {c['app']}", "",
                    "```text", c["caption"], "```"]
        elif t == "quiz":
            opts = "\n".join(f"  {'ABCD'[j]}. {o}" for j, o in enumerate(c["options"]))
            out += [f"**{i} · quiz** (answer: {'ABCD'[c['answer']]})", "", "```text", c["q"], "", opts, "",
                    "Why: " + c["why"], "```"]
        elif t == "reveal":
            out += [f"**{i} · reveal**", "", "```text", c["prompt"], "", "[ Reveal ]", "", c["answer"], "```"]
        elif t == "task":
            out += [f"**{i} · task** · tier `{c['tier']}` · {c['title']}", "", "```text", c["body"], "",
                    "(Reply with your proof of work, or SKIP)", "```"]
        elif t == "done":
            out += [f"**{i} · done**", "", "```text", c["body"], "```"]
        out.append("")
    return "\n".join(out)


# --------------------------------------------------------------- main ---
def main():
    idx = json.load(open(os.path.join(ROOT, "course-build", "index.json"), encoding="utf-8"))
    order = [dict(it, title=html.unescape(it["title"])) for it in idx["items"]]
    sb7 = load_js_object(os.path.join(ROOT, "course", "src", "sb7.js"), "SB7")
    videos = load_js_object(os.path.join(ROOT, "course", "src", "videos.js"), "VIDEOS")
    clips = load_clips()
    outdir = os.path.join(ROOT, "data", "whatsapp")
    os.makedirs(outdir, exist_ok=True)

    index, all_errs, stats = [], [], {}
    samples = {}
    for i, item in enumerate(order):
        fid = item["id"].replace(".", "-")
        src = open(os.path.join(ROOT, "course-build", "lessons", fid + ".html"), encoding="utf-8").read()
        cards = build_item(item, i, order, src, sb7, videos, clips)
        data = {"id": item["id"], "title": item["title"], "track": item["track"], "free": item["free"],
                "voice": GUIDES[i % 2][0], "cards": cards}
        errs = validate(fid, data, src)
        all_errs += errs
        with open(os.path.join(outdir, fid + ".json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write("\n")
        index.append({"id": item["id"], "title": item["title"], "track": item["track"], "free": item["free"],
                      "cards": len(cards)})
        counts = {}
        for c in cards:
            counts[c["t"]] = counts.get(c["t"], 0) + 1
        for k, v in counts.items():
            stats[k] = stats.get(k, 0) + v
        longest = max(max([len(v) for k, v in c.items() if isinstance(v, str) and k != "t"] or [0]) for c in cards)
        print(f"{item['id']:>4}  {len(cards):3d} cards  " + " ".join(f"{k}:{v}" for k, v in sorted(counts.items()))
              + f"  (longest {longest})")
        if item["id"] in SAMPLE_IDS:
            samples[item["id"]] = data

    with open(os.path.join(outdir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")

    doc = ["# WhatsApp scripts · sample", "",
           "Generated by `scripts/build_whatsapp_scripts.py` from the course lessons. Each block is one WhatsApp message "
           "exactly as sent (WhatsApp formatting: `*bold*`, `_italic_`, `` `code` ``). Quiz cards are sent as list "
           "messages, reveal cards with a Reveal button, task cards wait for the learner's proof of work.", ""]
    for sid in SAMPLE_IDS:
        if sid in samples:
            doc.append(render_sample(samples[sid]))
    with open(os.path.join(ROOT, "docs", "whatsapp-scripts-sample.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(doc).rstrip() + "\n")

    total = sum(e["cards"] for e in index)
    print(f"\n{len(index)} items, {total} cards ({total / len(index):.1f} per item): "
          + ", ".join(f"{k} {v}" for k, v in sorted(stats.items())))
    if all_errs:
        print(f"\n{len(all_errs)} validation problem(s):")
        for e in all_errs:
            print("  " + e)
        sys.exit(1)
    print("Validation passed.")


if __name__ == "__main__":
    main()
