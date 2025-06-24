import "@/components/linkCta.css";
import DOMPurify from "isomorphic-dompurify";
import React, { type ReactNode } from "react";
import MessageMarkdown from "@/components/messageMarkdown";
import { extractEmailPartsFromDocument } from "@/lib/shared/html";
import { cn } from "@/lib/utils";
import { createHighlightedText, highlightHtmlText } from "./highlight";
import { isHtmlContent } from "./isHtmlContent";

const extractEmailParts = (htmlString: string) =>
  extractEmailPartsFromDocument(
    new DOMParser().parseFromString(DOMPurify.sanitize(htmlString, { FORBID_TAGS: ["script", "style"] }), "text/html"),
  );

const adjustAttributes = (html: string) => {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    for (const tag of Array.from(doc.querySelectorAll("a"))) {
      tag.setAttribute("target", "_blank");
    }

    for (const img of Array.from(doc.querySelectorAll("img"))) {
      img.setAttribute("onerror", "this.style.display='none'");
    }

    return doc.body.innerHTML;
  } catch (e) {
    return html;
  }
};

export const highlightSearchTerm = createHighlightedText;

export const PlaintextContent = ({ text, searchQuery }: { text: string; searchQuery?: string }) => {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <p key={i}>{searchQuery ? createHighlightedText(line, searchQuery) : line}</p>
      ))}
    </>
  );
};

// Process HTML content safely with React components
const processHtmlWithHighlight = (html: string, searchQuery?: string): ReactNode => {
  // First sanitize the HTML
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "b",
      "i",
      "em",
      "strong",
      "p",
      "br",
      "div",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "mark",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "target", "rel"],
  });

  // If no search query, return as-is
  if (!searchQuery || searchQuery.trim() === "") {
    return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
  }

  // Use the existing HTML highlighting function
  const highlighted = highlightHtmlText(sanitized, searchQuery);
  return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

export const renderMessageBody = ({
  body,
  isMarkdown,
  className,
  searchQuery,
}: {
  body: string | null;
  isMarkdown: boolean;
  className?: string;
  searchQuery?: string;
}) => {
  if (isMarkdown) {
    return {
      mainContent: (
        <MessageMarkdown className={cn(className, "prose")} searchQuery={searchQuery}>
          {body}
        </MessageMarkdown>
      ),
      quotedContext: null,
    };
  }

  if (isHtmlContent(body)) {
    const { mainContent: parsedMain, quotedContext: parsedQuoted } = extractEmailParts(body || "");
    const adjustedMain = adjustAttributes(parsedMain);
    const adjustedQuoted = parsedQuoted ? adjustAttributes(parsedQuoted) : "";

    return {
      mainContent: <div className={cn(className, "prose")}>{processHtmlWithHighlight(adjustedMain, searchQuery)}</div>,
      quotedContext: adjustedQuoted ? (
        <div className={className}>{processHtmlWithHighlight(adjustedQuoted, searchQuery)}</div>
      ) : null,
    };
  }

  return {
    mainContent: (
      <div className={cn(className, "prose")}>
        {!body ? (
          <span className="text-muted-foreground">(no content)</span>
        ) : (
          <PlaintextContent text={body} searchQuery={searchQuery} />
        )}
      </div>
    ),
    quotedContext: null,
  };
};
