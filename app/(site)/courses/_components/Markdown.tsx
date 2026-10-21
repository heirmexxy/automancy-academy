import { Fragment } from "react";
import { parseMarkdown, parseVideo, type Block, type Inline } from "../_lib/core";

/**
 * Safe markdown: the text is parsed into a small AST (headings, paragraphs, lists, bold, italic, code, links,
 * quotes) and rendered as React elements. Raw HTML is never interpreted: "<script>" shows as text.
 * Works in server and client components (no server-only imports).
 */
function Inl({ items }: { items: Inline[] }) {
  return <>{items.map((n, i) => {
    switch (n.t) {
      case "text": return <Fragment key={i}>{n.v}</Fragment>;
      case "code": return <code key={i}>{n.v}</code>;
      case "b": return <strong key={i}><Inl items={n.c} /></strong>;
      case "i": return <em key={i}><Inl items={n.c} /></em>;
      case "a": {
        const external = !n.href.startsWith("/");
        return <a key={i} href={n.href} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}><Inl items={n.c} /></a>;
      }
    }
  })}</>;
}

function Blk({ b }: { b: Block }) {
  switch (b.t) {
    case "h": return b.level === 2 ? <h2><Inl items={b.c} /></h2> : b.level === 3 ? <h3><Inl items={b.c} /></h3> : <h4><Inl items={b.c} /></h4>;
    case "p": return <p><Inl items={b.c} /></p>;
    case "ul": return <ul>{b.items.map((it, i) => <li key={i}><Inl items={it} /></li>)}</ul>;
    case "ol": return <ol>{b.items.map((it, i) => <li key={i}><Inl items={it} /></li>)}</ol>;
    case "code": return <pre><code>{b.text}</code></pre>;
    case "quote": return <blockquote><Inl items={b.c} /></blockquote>;
    case "hr": return <hr />;
  }
}

export function Markdown({ source, className = "prose md" }: { source: string | null | undefined; className?: string }) {
  const blocks = parseMarkdown(source || "");
  if (!blocks.length) return null;
  return <div className={className}>{blocks.map((b, i) => <Blk key={i} b={b} />)}</div>;
}

/** Privacy-friendly embed (youtube-nocookie, Vimeo dnt=1, Loom) for an allowed link; nothing for anything else. */
export function VideoEmbed({ url, title }: { url: string | null | undefined; title: string }) {
  const v = parseVideo(url);
  if (!v) return <p className="alert warn">This video link isn't supported.</p>;
  return (
    <div className="mk-video">
      <iframe src={v.embed} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  const full = Math.round(value);
  return (
    <span className="mk-stars" aria-label={`Rated ${value.toFixed(1)} out of 5${count != null ? ` by ${count} learner${count === 1 ? "" : "s"}` : ""}`}>
      <span aria-hidden="true">{"★".repeat(full)}{"☆".repeat(5 - full)}</span>
      {count != null && <span className="muted"> {value.toFixed(1)} ({count})</span>}
    </span>
  );
}
