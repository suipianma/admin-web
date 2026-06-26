"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { HLJSApi } from "highlight.js";

interface LazyCodeBlockProps {
  language: string | null;
  value: string;
}

const LANG_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
};

async function registerLanguage(hljs: HLJSApi, lang: string) {
  switch (lang) {
    case "javascript":
      hljs.registerLanguage(
        "javascript",
        (await import("highlight.js/lib/languages/javascript")).default
      );
      break;
    case "typescript":
      hljs.registerLanguage(
        "typescript",
        (await import("highlight.js/lib/languages/typescript")).default
      );
      break;
    case "json":
      hljs.registerLanguage(
        "json",
        (await import("highlight.js/lib/languages/json")).default
      );
      break;
    case "bash":
      hljs.registerLanguage(
        "bash",
        (await import("highlight.js/lib/languages/bash")).default
      );
      break;
    case "python":
      hljs.registerLanguage(
        "python",
        (await import("highlight.js/lib/languages/python")).default
      );
      break;
    case "java":
      hljs.registerLanguage(
        "java",
        (await import("highlight.js/lib/languages/java")).default
      );
      break;
    case "sql":
      hljs.registerLanguage(
        "sql",
        (await import("highlight.js/lib/languages/sql")).default
      );
      break;
    case "xml":
      hljs.registerLanguage(
        "xml",
        (await import("highlight.js/lib/languages/xml")).default
      );
      break;
    case "css":
      hljs.registerLanguage(
        "css",
        (await import("highlight.js/lib/languages/css")).default
      );
      break;
    default:
      break;
  }
}

function LazyCodeBlock({ language, value }: LazyCodeBlockProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    async function runHighlight() {
      const { default: hljs } = await import("highlight.js/lib/core");
      const lang = language
        ? LANG_ALIASES[language.toLowerCase()] ?? language.toLowerCase()
        : null;

      if (lang && !hljs.getLanguage(lang)) {
        await registerLanguage(hljs, lang);
      }

      if (cancelled) return;

      if (lang && hljs.getLanguage(lang)) {
        setHtml(hljs.highlight(value, { language: lang }).value);
      } else {
        setHtml(null);
      }
    }

    void runHighlight();
    return () => {
      cancelled = true;
    };
  }, [visible, language, value]);

  return (
    <div ref={rootRef} className="msg-ast-code-wrap">
      {language && <div className="msg-ast-code-lang">{language}</div>}
      <pre className="msg-ast-code">
        {html != null ? (
          <code
            className={`hljs${language ? ` language-${language}` : ""}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <code ref={codeRef}>{visible ? value : ""}</code>
        )}
      </pre>
    </div>
  );
}

export default memo(LazyCodeBlock);
