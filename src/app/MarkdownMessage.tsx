import { Fragment, ReactNode } from "react";

import styles from "./MarkdownMessage.module.css";

const MARKDOWN_SPECIAL_LINE_PATTERNS = [/^#{1,3}\s+/, /^>\s+/, /^[-*\u2022]\s+/, /^\d+[.)]\s+/, /^```/];

const isMarkdownSpecialLine = (line: string) =>
  MARKDOWN_SPECIAL_LINE_PATTERNS.some((pattern) => pattern.test(line));

const renderInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const chunks = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  const nodes: ReactNode[] = [];

  chunks.forEach((chunk, index) => {
    if (!chunk) {
      return;
    }

    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-code-${index}`} className={styles.inlineCode}>
          {chunk.slice(1, -1)}
        </code>,
      );
      return;
    }

    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-strong-${index}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }

    if (chunk.startsWith("*") && chunk.endsWith("*")) {
      nodes.push(<em key={`${keyPrefix}-em-${index}`}>{chunk.slice(1, -1)}</em>);
      return;
    }

    const linkMatch = chunk.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (linkMatch) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          {linkMatch[1]}
        </a>,
      );
      return;
    }

    nodes.push(<span key={`${keyPrefix}-text-${index}`}>{chunk}</span>);
  });

  return nodes;
};

export const MarkdownMessage = ({ text }: { text: string }) => {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex]?.trimEnd() ?? "";

    if (!line.trim()) {
      lineIndex += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !lines[lineIndex].startsWith("```")) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      lineIndex += 1;
      blocks.push(
        <pre key={`pre-${lineIndex}`} className={styles.codeBlock}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const className =
        headingMatch[1].length === 1
          ? styles.heading1
          : headingMatch[1].length === 2
            ? styles.heading2
            : styles.heading3;
      blocks.push(
        <p key={`h-${lineIndex}`} className={className}>
          {renderInlineMarkdown(headingMatch[2], `h-${lineIndex}`)}
        </p>,
      );
      lineIndex += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (lineIndex < lines.length && /^>\s+/.test(lines[lineIndex])) {
        quoteLines.push(lines[lineIndex].replace(/^>\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <blockquote key={`q-${lineIndex}`} className={styles.blockquote}>
          {quoteLines.join(" ")}
        </blockquote>,
      );
      continue;
    }

    if (/^[-*\u2022]\s+/.test(line)) {
      const listLines: string[] = [];
      while (lineIndex < lines.length && /^[-*\u2022]\s+/.test(lines[lineIndex])) {
        listLines.push(lines[lineIndex].replace(/^[-*\u2022]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ul key={`ul-${lineIndex}`} className={styles.list}>
          {listLines.map((item, index) => (
            <li key={`ul-${lineIndex}-${index}`}>{renderInlineMarkdown(item, `ul-${lineIndex}-${index}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const listLines: string[] = [];
      while (lineIndex < lines.length && /^\d+[.)]\s+/.test(lines[lineIndex])) {
        listLines.push(lines[lineIndex].replace(/^\d+[.)]\s+/, ""));
        lineIndex += 1;
      }
      blocks.push(
        <ol key={`ol-${lineIndex}`} className={styles.list}>
          {listLines.map((item, index) => (
            <li key={`ol-${lineIndex}-${index}`}>{renderInlineMarkdown(item, `ol-${lineIndex}-${index}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraphLines = [line];
    lineIndex += 1;
    while (
      lineIndex < lines.length &&
      lines[lineIndex].trim().length > 0 &&
      !isMarkdownSpecialLine(lines[lineIndex])
    ) {
      paragraphLines.push(lines[lineIndex]);
      lineIndex += 1;
    }

    blocks.push(
      <p key={`p-${lineIndex}`} className={styles.paragraph}>
        {paragraphLines.map((paragraphLine, index) => (
          <Fragment key={`p-${lineIndex}-${index}`}>
            {renderInlineMarkdown(paragraphLine, `p-${lineIndex}-${index}`)}
            {index < paragraphLines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={styles.message}>{blocks}</div>;
};
