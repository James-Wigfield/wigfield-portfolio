/**
 * PORTARA-TEST build step: keep the portfolio's own CSS off the /portara-test route.
 *
 * The landing page and the portfolio both use generic class names (.hero,
 * .container, .section, .btn, .lead ...) and the portfolio's stylesheets are in
 * the global bundle, so they were restyling the Portara page. Rather than
 * rename anything on either side, this PostCSS plugin rewrites every selector
 * in the portfolio's CSS so it only matches while <html> does NOT carry the
 * `portara-test` class (index.tsx adds it on mount, removes it on unmount).
 *
 * It is a strict no-op for the portfolio: the guard is a `:where()` clause,
 * which adds ZERO specificity, so the cascade is unchanged on every other page.
 *
 *   .btn                   ->  :where(html:not(.portara-test)) .btn
 *   html.hp-active         ->  html.hp-active:where(:not(.portara-test))
 *   :root[data-theme=dark] ->  :root[data-theme=dark]:where(:not(.portara-test))
 *   *, *::before           ->  :where(html:not(.portara-test)) *, html:where(:not(.portara-test)),
 *                              :where(html:not(.portara-test)) *::before, html:where(:not(.portara-test))::before
 *
 * Skipped: files under src/portara-test/ and node_modules, @keyframes steps,
 * and nested rules (they inherit their parent's scope). Wired up in
 * vite.config.js under css.postcss.plugins, which runs after Vite has inlined
 * any @import, so imported files are covered too.
 */

const CLASS = "portara-test";
const GUARD = `:where(html:not(.${CLASS}))`;
const SELF = `:where(:not(.${CLASS}))`;

const LEGACY_PSEUDO_ELEMENTS = /^:(before|after|first-line|first-letter)(?![\w-])/;

/** Index just past the first compound selector, but before any pseudo-element in it. */
function firstCompoundEnd(sel) {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0) {
      if (ch === " " || ch === ">" || ch === "+" || ch === "~") return i;
      if (ch === ":" && (sel[i + 1] === ":" || LEGACY_PSEUDO_ELEMENTS.test(sel.slice(i)))) return i;
    }
  }
  return sel.length;
}

function scopeSelector(raw) {
  const sel = raw.trim();
  if (/^(html|:root)(?![\w-])/.test(sel)) {
    // Can only match <html> itself: guard that compound directly.
    const at = firstCompoundEnd(sel);
    return sel.slice(0, at) + SELF + sel.slice(at);
  }
  if (sel.startsWith("*")) {
    // Matches <html> and every descendant: cover both.
    return `${GUARD} ${sel}, html${SELF}${sel.slice(1)}`;
  }
  return `${GUARD} ${sel}`;
}

function insideKeyframes(rule) {
  for (let p = rule.parent; p; p = p.parent) {
    if (p.type === "atrule" && /keyframes$/i.test(p.name)) return true;
  }
  return false;
}

export function scopePortfolioCss() {
  return {
    postcssPlugin: "portara-test-scope-portfolio-css",
    Once(root) {
      const file = (root.source?.input?.file ?? "").split("\\").join("/");
      if (!file.includes("/src/")) return;
      if (file.includes("/src/portara-test/") || file.includes("/node_modules/")) return;
      root.walkRules((rule) => {
        if (rule.parent?.type === "rule") return; // nested rule: scoped through its parent
        if (insideKeyframes(rule)) return;
        rule.selectors = rule.selectors.map(scopeSelector);
      });
    },
  };
}
scopePortfolioCss.postcss = true;
