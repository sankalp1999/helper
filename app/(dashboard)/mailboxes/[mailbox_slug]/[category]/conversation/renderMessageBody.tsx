import "@/components/linkCta.css";
import React from "react";
import DOMPurify from "isomorphic-dompurify";
import MessageMarkdown from "@/components/messageMarkdown";
import { extractEmailPartsFromDocument } from "@/lib/shared/html";
import { cn } from "@/lib/utils";

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

export const highlightSearchTerm = (text: string, searchTerm: string): React.ReactNode => {
  if (!searchTerm || searchTerm.trim() === "") return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchTerm.toLowerCase()) {
      return (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-900/70 text-yellow-900 dark:text-yellow-100 rounded px-1 py-0.5 font-semibold border border-yellow-300 dark:border-yellow-700"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
};

export const PlaintextContent = ({ text, searchQuery }: { text: string; searchQuery?: string }) => {
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <p key={i}>
          {searchQuery ? highlightSearchTerm(line, searchQuery) : line}
        </p>
      ))}
    </>
  );
};

const highlightHtmlContent = (html: string, searchTerm: string): string => {
  if (!searchTerm || searchTerm.trim() === "") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node;

  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");

  textNodes.forEach((textNode) => {
    const text = textNode.textContent || "";
    const matches = text.match(regex);
    
    if (matches && matches.length > 0) {
      const span = document.createElement("span");
      const parts = text.split(regex);
      
      parts.forEach((part, index) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          const mark = document.createElement("mark");
          mark.className = "bg-yellow-200 dark:bg-yellow-900/70 text-yellow-900 dark:text-yellow-100 rounded px-1 py-0.5 font-semibold border border-yellow-300 dark:border-yellow-700";
          mark.textContent = part;
          span.appendChild(mark);
        } else {
          span.appendChild(document.createTextNode(part));
        }
      });
      
      textNode.parentNode?.replaceChild(span, textNode);
    }
  });

  return doc.body.innerHTML;
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

  if (body?.includes("<") && body.includes(">")) {
    const { mainContent: parsedMain, quotedContext: parsedQuoted } = extractEmailParts(body || "");
    let adjustedMain = adjustAttributes(parsedMain);
    let adjustedQuoted = parsedQuoted ? adjustAttributes(parsedQuoted) : "";

    if (searchQuery) {
      adjustedMain = highlightHtmlContent(adjustedMain, searchQuery);
      adjustedQuoted = adjustedQuoted ? highlightHtmlContent(adjustedQuoted, searchQuery) : "";
    }

    return {
      mainContent: <div className={cn(className, "prose")} dangerouslySetInnerHTML={{ __html: adjustedMain }} />,
      quotedContext: adjustedQuoted ? (
        <div className={className} dangerouslySetInnerHTML={{ __html: adjustedQuoted }} />
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
