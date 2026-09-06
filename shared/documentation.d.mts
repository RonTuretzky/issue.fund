export type DocSection = {
  title: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
  code?: string;
  notice?: string;
  table?: { headers: string[]; rows: string[][] };
  links?: { label: string; url: string }[];
  deployment?: boolean;
};
export type DocPage = {
  id: string;
  group: string;
  title: string;
  summary: string;
  sections: DocSection[];
};
export const groups: { id: string; title: string; description: string }[];
export const pages: DocPage[];
export const maintainerAutomation: {
  title: string;
  paragraphs: string[];
  links: { label: string; url: string }[];
};
