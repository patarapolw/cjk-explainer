import MarkdownIt from "markdown-it";

export const markdownIt = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
});
