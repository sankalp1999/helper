import React from "react";
import ReactMarkdown from "react-markdown";
import { createHighlightedText } from "@/app/(dashboard)/mailboxes/[mailbox_slug]/[category]/conversation/highlight";

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

const processChildrenForHighlight = (children: React.ReactNode, searchQuery: string): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      return createHighlightedText(child, searchQuery);
    }

    if (React.isValidElement(child) && child.props && typeof child.props === "object" && "children" in child.props) {
      return React.cloneElement(child, {
        ...(child.props as any),
        children: processChildrenForHighlight((child.props as any).children, searchQuery),
      });
    }

    return child;
  });
};

const createRobustTextHighlighter = (Component: string, searchQuery?: string) => {
  return ({ children, ...props }: any) => {
    if (!searchQuery) {
      return React.createElement(Component, props, children);
    }

    const highlightedChildren = processChildrenForHighlight(children, searchQuery);
    return React.createElement(Component, props, highlightedChildren);
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
        {searchQuery ? processChildrenForHighlight(children, searchQuery) : children}
      </a>
    ),
  };

  if (searchQuery) {
    const textComponents = [
      "p",
      "span",
      "strong",
      "em",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "td",
      "th",
    ];

    textComponents.forEach((component) => {
      customComponents[component] = createRobustTextHighlighter(component, searchQuery);
    });
  }

  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkAutolink]}
      rehypePlugins={[rehypeAddWbrAfterSlash]}
      components={customComponents}
    >
      {children || ""}
    </ReactMarkdown>
  );
}
