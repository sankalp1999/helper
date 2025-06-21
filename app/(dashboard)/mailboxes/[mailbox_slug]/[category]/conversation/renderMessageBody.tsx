import "@/components/linkCta.css";
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

export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm || searchTerm.trim() === "") return text;

  const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(
    regex,
    '<mark class="bg-yellow-200 dark:bg-yellow-900/70 text-yellow-900 dark:text-yellow-100 rounded px-1 py-0.5 font-semibold border border-yellow-300 dark:border-yellow-700">$1</mark>',
  );
};

export const PlaintextContent = ({ text, searchQuery }: { text: string; searchQuery?: string }) => {
  const lines = text.split("\n");

  if (searchQuery) {
    return (
      <>
        {lines.map((line, i) => (
          <p key={i} dangerouslySetInnerHTML={{ __html: highlightSearchTerm(line, searchQuery) }} />
        ))}
      </>
    );
  }

  return (
    <>
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </>
  );
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
      adjustedMain = highlightSearchTerm(adjustedMain, searchQuery);
      adjustedQuoted = adjustedQuoted ? highlightSearchTerm(adjustedQuoted, searchQuery) : "";
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
