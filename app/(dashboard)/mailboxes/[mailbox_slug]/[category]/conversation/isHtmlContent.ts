export const isHtmlContent = (body?: string | null): boolean => {
  if (!body) return false;
  const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
  return htmlTagRegex.test(body);
};
