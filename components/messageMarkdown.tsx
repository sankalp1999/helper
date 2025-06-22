import React from "react";
import ReactMarkdown from "react-markdown";

const rehypeAddWbrAfterSlash = () => {
  return (tree: any) => {
    const nodesToReplace: { node: any; newChildren: any[] }[] = [];

    const walk = (node: any): void => {
      if (node.type === "text" && node.value && typeof node.value === "string" && node.value.includes("/")) {
        const parts = node.value.split(/(\/{1,})/);
        if (parts.length > 1) {
          const newChildren: any[] = [];
          parts.forEach((part: string, index: number) => {
            if (/^\/{1,}$/.test(part)) {
              newChildren.push({ type: "text", value: part });
              newChildren.push({ type: "element", tagName: "wbr", properties: {}, children: [] });
            } else if (part) {
              newChildren.push({ type: "text", value: part });
            }
          });

          nodesToReplace.push({ node, newChildren });
        }
      }

      if (node.children) {
        for (const child of node.children) {
          child.parent = node;
          walk(child);
        }
      }
    };

    walk(tree);

    nodesToReplace.forEach(({ node, newChildren }) => {
      if (node.parent?.children) {
        const nodeIndex = node.parent.children.indexOf(node);
        node.parent.children.splice(nodeIndex, 1, ...newChildren);
      }
    });
  };
};

const remarkAutolink = () => {
  return (tree: any) => {
    const nodesToReplace: { node: any; newChildren: any[] }[] = [];

    const isInsideLink = (node: any): boolean => {
      let parent = node.parent;
      while (parent) {
        if (parent.type === "link") {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    };

    const walk = (node: any): void => {
      if (node.type === "text" && node.value && typeof node.value === "string" && !isInsideLink(node)) {
        const urlRegex = /(https?:\/\/[^\s<>"\[\]{}|\\^`]+?)(?=[.,;:!?)\]}]*(?:\s|$))/gi;
        const matches = Array.from(node.value.matchAll(urlRegex));

        if (matches.length > 0) {
          const newChildren: any[] = [];
          let lastIndex = 0;

          matches.forEach((match: unknown) => {
            const regexMatch = match as RegExpMatchArray;
            const url = regexMatch[1];
            if (!url || regexMatch.index === undefined) return;

            const matchStart = regexMatch.index;
            const matchEnd = matchStart + url.length;

            if (lastIndex < matchStart) {
              newChildren.push({
                type: "text",
                value: node.value.slice(lastIndex, matchStart),
              });
            }

            newChildren.push({
              type: "link",
              url,
              children: [{ type: "text", value: url }],
            });

            lastIndex = matchEnd;
          });

          if (lastIndex < node.value.length) {
            newChildren.push({
              type: "text",
              value: node.value.slice(lastIndex),
            });
          }

          if (newChildren.length > 0) {
            nodesToReplace.push({ node, newChildren });
          }
        }
      }

      if (node.children) {
        for (const child of node.children) {
          child.parent = node;
          walk(child);
        }
      }
    };

    walk(tree);

    nodesToReplace.forEach(({ node, newChildren }) => {
      if (node.parent?.children) {
        const nodeIndex = node.parent.children.indexOf(node);
        node.parent.children.splice(nodeIndex, 1, ...newChildren);
      }
    });
  };
};

interface MessageMarkdownProps {
  children: string | null;
  className?: string;
  components?: any;
  searchQuery?: string;
}

export default function MessageMarkdown({ children, className, components, searchQuery }: MessageMarkdownProps) {
  const customComponents = {
    ...components,
    a: ({ children, ...props }: any) => (
      <a target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    ),
  };

  if (searchQuery) {
    const highlightText = (text: string) => {
      if (!searchQuery || !text || typeof text !== "string") return text;

      const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      const parts = text.split(regex);

      return parts.map((part, index) => {
        if (part.toLowerCase() === searchQuery.toLowerCase()) {
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

    const createTextHighlighter = (Component: any) => {
      return ({ children, ...props }: any) => {
        if (typeof children === "string") {
          return React.createElement(Component, props, highlightText(children));
        }
        return React.createElement(Component, props, children);
      };
    };

    customComponents.p = createTextHighlighter("p");
    customComponents.span = createTextHighlighter("span");
    customComponents.strong = createTextHighlighter("strong");
    customComponents.em = createTextHighlighter("em");
    customComponents.li = createTextHighlighter("li");
    customComponents.h1 = createTextHighlighter("h1");
    customComponents.h2 = createTextHighlighter("h2");
    customComponents.h3 = createTextHighlighter("h3");
    customComponents.h4 = createTextHighlighter("h4");
    customComponents.h5 = createTextHighlighter("h5");
    customComponents.h6 = createTextHighlighter("h6");
    customComponents.blockquote = createTextHighlighter("blockquote");
    customComponents.code = createTextHighlighter("code");
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkAutolink]}
      rehypePlugins={[rehypeAddWbrAfterSlash]}
      components={customComponents}
    >
      {children}
    </ReactMarkdown>
  );
}
