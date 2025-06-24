import React from "react";

/**
 * Creates highlighted text using React components instead of DOM manipulation
 * This is safe for SSR and works consistently across all content types
 */
export const createHighlightedText = (
  text: string,
  searchQuery?: string,
  highlightClassName = "search-highlight",
): React.ReactNode | string => {
  if (!searchQuery || searchQuery.trim() === "") return text;

  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchQuery.toLowerCase()) {
      return (
        <mark key={index} className={highlightClassName}>
          {part}
        </mark>
      );
    }
    return part;
  });
};

/**
 * Helper to create a text component wrapper that applies highlighting
 * Used to wrap various markdown/HTML elements
 */
export const createTextHighlighter = (
  Component: React.ElementType,
  searchQuery?: string,
  highlightClassName?: string,
) => {
  return ({ children, ...props }: any) => {
    if (typeof children === "string" && searchQuery) {
      return React.createElement(Component, props, createHighlightedText(children, searchQuery, highlightClassName));
    }
    return React.createElement(Component, props, children);
  };
};

/**
 * Counts the number of matches in a text string
 * Used for search match counting
 */
export const countMatches = (text: string, searchQuery: string): number => {
  if (!searchQuery || searchQuery.trim() === "" || !text) return 0;

  const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const matches = text.match(regex);
  return matches ? matches.length : 0;
};

/**
 * Processes an HTML string to extract text content and apply highlighting
 * This is a simplified version that avoids DOM manipulation
 */
export const highlightHtmlText = (html: string, searchQuery?: string): string => {
  if (!searchQuery || searchQuery.trim() === "") return html;

  // This is a simple regex-based approach that highlights text within HTML
  // It avoids matching text inside HTML tags
  const regex = new RegExp(`(>|^)([^<]*)?(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})([^<]*)?(<|$)`, "gi");

  return html.replace(regex, (match, prefix, before, term, after, suffix) => {
    const highlighted = `<mark class="search-highlight">${term}</mark>`;
    return `${prefix}${before || ""}${highlighted}${after || ""}${suffix}`;
  });
};
