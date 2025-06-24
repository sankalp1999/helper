"use client";

export const highlightKeywords = (htmlString: string, keywords: string[]) => {
  if (!keywords.length) return htmlString;

  let result = htmlString;

  // Process each keyword
  keywords.forEach((keyword) => {
    // Escape special regex characters in the keyword
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Simple regex that matches whole words
    // We rely on the fact that the input is already escaped HTML
    const regex = new RegExp(`\\b(${escapedKeyword})\\b`, "gi");

    // Replace matches with highlighted version
    result = result.replace(regex, '<mark class="bg-secondary-200">$1</mark>');
  });

  return result;
};
