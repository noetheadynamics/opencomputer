import * as React from "react";

interface MessageContentProps {
  content: string;
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] font-mono"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderMarkdown(raw: string): React.ReactNode[] {
  const lines = raw.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] font-mono"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mb-1 mt-3 text-sm font-semibold text-oc-text-primary">
          {parseInline(line.slice(4))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mb-1 mt-4 text-base font-semibold text-oc-text-primary">
          {parseInline(line.slice(3))}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="mb-1 mt-4 text-lg font-bold text-oc-text-primary">
          {parseInline(line.slice(2))}
        </h1>,
      );
      continue;
    }

    // Unordered list
    if (line.match(/^[\s]*[-*]\s/)) {
      const text = line.replace(/^[\s]*[-*]\s/, "");
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="text-oc-accent">•</span>
          <span>{parseInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Ordered list
    const orderedMatch = line.match(/^[\s]*(\d+)\.\s(.+)/);
    if (orderedMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 pl-2">
          <span className="text-oc-accent">{orderedMatch[1]}.</span>
          <span>{parseInline(orderedMatch[2])}</span>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key++}
          className="my-1 border-l-2 border-oc-accent/40 pl-3 text-oc-text-secondary italic"
        >
          {parseInline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push(<hr key={key++} className="my-3 border-white/10" />);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Normal paragraph
    elements.push(
      <div key={key++} className="leading-relaxed">
        {parseInline(line)}
      </div>,
    );
  }

  // Close unclosed code block
  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key={key++}
        className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[13px] font-mono"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }

  return elements;
}

export const MessageContent = React.memo(function MessageContent({ content }: MessageContentProps) {
  if (!content) return null;
  return <div className="space-y-1">{renderMarkdown(content)}</div>;
});
