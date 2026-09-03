/**
 * /portara-test - the Portara landing page, running inside the portfolio SPA.
 *
 * The only file in this folder that is not a mirror of portara-repo. In the
 * real app React Router's framework mode applies home.tsx's `links()` and
 * `meta()` exports to <head> server-side; here we do it by hand while the
 * route is mounted and undo it on the way out, so the portfolio's own pages
 * never see the landing stylesheets. See README.md.
 */
import { useEffect, useState } from "react";

import Home, { links, meta } from "./home";
import preflight from "./shim/preflight.css?url";

type HeadLink = { rel: string; href: string; crossOrigin?: string };

// What apps/control-plane/app/root.tsx puts in <head> on every page: the brand
// fonts and the token layer (there via app.css + Tailwind, here via
// shim/preflight.css).
const ROOT_LINKS: HeadLink[] = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Jost:wght@400..700&display=swap",
  },
  { rel: "stylesheet", href: preflight },
];

export default function PortaraTest() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const head = document.head;
    const html = document.documentElement;
    const prevTitle = document.title;
    const prevTheme = html.getAttribute("data-theme");

    // root.tsx stamps the saved theme on <html>; the landing page's default is
    // light (tokens.css). Without this the portfolio's dark :root would win.
    html.setAttribute("data-theme", "light");
    html.classList.add("portara-test");

    const created: Element[] = [];
    const pending: Promise<void>[] = [];
    for (const l of [...ROOT_LINKS, ...(links() as HeadLink[])]) {
      const el = document.createElement("link");
      el.rel = l.rel;
      el.href = l.href;
      if (l.crossOrigin) el.crossOrigin = l.crossOrigin;
      if (l.rel === "stylesheet") {
        pending.push(
          new Promise<void>((resolve) => {
            el.onload = () => resolve();
            el.onerror = () => resolve();
          }),
        );
      }
      head.appendChild(el);
      created.push(el);
    }
    for (const m of meta()) {
      if ("title" in m) {
        document.title = m.title;
        continue;
      }
      const el = document.createElement("meta");
      el.name = m.name;
      el.content = m.content;
      head.appendChild(el);
      created.push(el);
    }

    // Hold the first paint until the sheets are in. The real page arrives
    // styled because SSR puts the <link>s in <head>; here it would otherwise
    // flash unstyled for a frame or two.
    let cancelled = false;
    const fallback = setTimeout(() => !cancelled && setReady(true), 2000);
    Promise.all(pending).then(() => !cancelled && setReady(true));

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      for (const el of created) el.remove();
      document.title = prevTitle;
      if (prevTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", prevTheme);
      html.classList.remove("portara-test");
    };
  }, []);

  return ready ? <Home /> : null;
}
