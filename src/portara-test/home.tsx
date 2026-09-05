import type { FormEvent, ReactElement } from "react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "./shim/router";

import Magnet from "./bits/Magnet";
import { CurtinLogo } from "./components/curtin-logo";
import { UwaLogo } from "./components/uwa-logo";
import { HeroScene } from "./components/hero-scene";
import { HowItWorks } from "./components/how-it-works";
import { LogoMarquee } from "./components/logo-marquee";
import { useNavReveal } from "./components/nav-reveal";

// The 3D hero (toggle at the top of the page) brings three.js with it, so it
// only loads when chosen.
const Hero3D = lazy(() => import("./components/hero-3d"));
import { Reveal, RevealText } from "./components/reveal";
import { SectionRule } from "./components/section-rule";
import { ToolboxBuilder } from "./components/toolbox-builder";
import { submitLead, turnstileSiteKey, type LeadResult } from "./shim/server";
import { INDUSTRIES } from "./lib/plans";
import { DEMO_LAYOUT, DEMO_WORKERS } from "./lib/demo-office";
import homeStyles from "./portal-ui/styles/home.css?url";
import homeV2Styles from "./portal-ui/styles/home-v2.css?url";
import portalStyles from "./portal-ui/styles/portal.css?url";

// PORTARA-TEST, second pass (2026-09-03): the landing page redesign. The
// pixel-art cover is gone; the page opens on the brand sting and hands off
// into the workspace tour on scroll (components/hero-scene.tsx). Under the
// tour, a toolbox that builds itself per industry (components/toolbox-
// builder.tsx) replaces the old statement. Sections lost their numbers,
// Integrations moved above Security, How it works became a four-step flow
// line (components/how-it-works.tsx), the team is two editorial portraits,
// and the copy arrives with scroll reveals (components/reveal.tsx, bits/).
// Everything new is styled in portal-ui/styles/home-v2.css so home.css stays
// a mirror of the live one.

// The live office showcase is client-only three.js - code-split and mounted
// after hydration, exactly like the portal's office view.
const OfficeBuilder = lazy(() => import("./portal-ui/components/office3d/builder"));
// The security section's permission vignette shares the same 3D stack.
const SecurityDemo = lazy(() => import("./portal-ui/components/office3d/security-demo"));
// As does the integrations section's platform-ring vignette.
const IntegrationsDemo = lazy(
  () => import("./portal-ui/components/office3d/integrations-demo"),
);

export const links = () => [
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap",
  },
  { rel: "stylesheet", href: homeStyles },
  // Only for the .px-office* classes the 3D showcase uses - everything in
  // portal.css is .px- prefixed, so it can't collide with home.css.
  { rel: "stylesheet", href: portalStyles },
  // The redesign, layered last so it can restate anything above.
  { rel: "stylesheet", href: homeV2Styles },
];

export function meta() {
  return [
    { title: "Portara · Custom staff portals for local business" },
    {
      name: "description",
      content:
        "Portara builds small businesses a simple, custom staff portal: a dashboard and the tools you actually use, run through Claude. Local, fixed pricing, no lock-in.",
    },
    { name: "theme-color", content: "#0c131b" },
  ];
}

// PORTARA-TEST: the route's loader (Turnstile site key, session refresh) and
// action (honeypot, Turnstile verify, hq.lead_submit) are server code with
// nowhere to run in a Vite SPA. Their client-side stand-ins live in
// shim/server.ts; the real ones are in apps/control-plane/app/routes/home.tsx.

// Turnstile's browser API, injected by the script below.
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; theme?: "auto" | "light" | "dark" },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

// One shared loader so the script tag is only ever added once, however many
// times the widget mounts.
let turnstileScript: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return turnstileScript;
}

/**
 * The CAPTCHA on the meeting-request form. Renders Cloudflare Turnstile
 * (managed mode - invisible for almost everyone) into the form; the widget
 * adds a hidden cf-turnstile-response input the action verifies server-side.
 * Client-only by nature, so it mounts after hydration - explicit rendering
 * keeps it correct no matter how the script load races React.
 */
function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!host) return;
    let gone = false;
    let widgetId: string | null = null;

    loadTurnstileScript().then(() => {
      if (gone || !window.turnstile) return;
      widgetId = window.turnstile.render(host, {
        sitekey: siteKey,
        theme: "auto",
      });
    });

    return () => {
      gone = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [host, siteKey]);

  return <div ref={setHost} />;
}

/**
 * The two people a client actually deals with. Names, faces, and what each
 * of them does for you in three lines - for a local business buying from a
 * two-person studio the faces are the proof, and the redesign trades the bio
 * paragraph for a scannable list.
 *
 * public/team holds ONLY the two shipped .webp files. The originals are
 * deliberately not in the repo: everything under public/ is uploaded and
 * served, so a source left there is a public URL, and Justin's source is the
 * uncropped frame he asked to have cropped. Keep new originals outside the
 * repo and commit only the derivative.
 *
 * How the derivatives were made, so a replacement matches rather than
 * guesses. Both are sharp, `fit: inside` + `withoutEnlargement`, capped near
 * 1010px - twice the width the well renders at. James's is his headshot
 * untouched at 800x800, quality 86. Justin's is squared out of a 1122x1402
 * export - extract { left: 75, top: 412, width: 990, height: 990 }, quality
 * 82 - taking the height off the TOP, so the headroom above his hair lands at
 * 8% of the frame where James's sits at 7%. The photo is shown WHOLE - the
 * well letterboxes rather than crops.
 */
type TeamMember = {
  name: string;
  role: string;
  photo: string;
  width: number;
  height: number;
  /** What this person does for a client, first person, three lines. */
  does: string[];
  /** A qualification worth showing. The logo is a component, not a URL, so it
      can take the page's text colour - see CurtinLogo. */
  credential?: { logo: () => ReactElement; detail: string };
  /** Their own site, if they have one. */
  website?: string;
  /** Public profile, for a buyer who wants to check the claim themselves. */
  linkedin?: string;
};

const TEAM: TeamMember[] = [
  {
    name: "James Wigfield",
    role: "Co-founder, AI and automation",
    photo: "/portara-test/team/james.webp",
    width: 800,
    height: 800,
    does: [
      "Sits down with you and maps how the business actually runs",
      "Designs the portal, and the Portlets, around that",
      "Is the one who picks up when you call",
    ],
    credential: {
      logo: () => <UwaLogo className="person__credlogo" />,
      // No year, deliberately: the degree runs to Oct 2026, and where Justin's
      // row carries a completion year this one must not.
      detail: "Advanced Computer Science (Hons), AI major",
    },
    website: "https://jameswigfield.com/",
    linkedin: "https://www.linkedin.com/in/james-wigfield-66381737a/",
  },
  {
    name: "Justin Steyn",
    role: "Co-founder, engineering",
    photo: "/portara-test/team/justin.webp",
    width: 990,
    height: 990,
    does: [
      "Builds and runs the platform your portal sits on",
      "Wires in Xero, Shopify, Microsoft, whatever you already use",
      "Keeps every Portlet scoped to exactly what it should touch",
    ],
    credential: {
      logo: () => <CurtinLogo className="person__credlogo" />,
      detail: "Bachelor of Information Technology, 2024",
    },
    website: "https://juzzin.com/",
    linkedin: "https://www.linkedin.com/in/justinjsteyn/",
  },
];

/** A globe, for a personal-site link. Drawn to the same weight as the
    LinkedIn mark beside it so the two links read as one pair. */
function SiteMark() {
  return (
    <svg
      className="person__profileicon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20a15.3 15.3 0 0 1 0-20Z" />
    </svg>
  );
}

/** The LinkedIn mark, for the profile link on a team card. */
function LinkedInMark() {
  return (
    <svg
      className="person__profileicon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.13 1.45-2.13 2.94v5.66H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0Z" />
    </svg>
  );
}

/**
 * A team portrait. The real photo, falling back to an initials tile in the
 * same well if the file isn't there - so a missing photo reads as a design
 * choice rather than a broken image.
 */
function Portrait({ person }: { person: TeamMember }) {
  const [failed, setFailed] = useState(false);
  const initials = person.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="team2__photo">
      {failed ? (
        <span className="person__mono" aria-hidden="true">
          {initials}
        </span>
      ) : (
        <img
          src={person.photo}
          alt={person.name}
          width={person.width}
          height={person.height}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** The section boundary: a full-width hairline that draws in on scroll, with
    the section's title under its left end (components/section-rule.tsx). */
function SectionLabel({ title }: { title: string }) {
  return <SectionRule title={title} />;
}

/**
 * Portara's own office, live on the landing page. The builder's showcase
 * mode: the camera slowly laps the floor by itself, every control and every
 * scrap of UI is hidden, the canvas is transparent so the page background
 * shows through, and nothing is editable or touches a database. Data is
 * baked in app/lib/demo-office.ts.
 */
function OfficeShowcase() {
  // The 3D chunk is heavy (~260 kB gzip), so don't fetch it until the
  // section is about to scroll into view.
  const [mounted, setMounted] = useState(false);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hostEl) return;
    if (!("IntersectionObserver" in window)) {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(hostEl);
    return () => io.disconnect();
  }, [hostEl]);

  const placeholder = (
    <div className="office-demo__placeholder">
      <span>Waking the portlets…</span>
    </div>
  );

  return (
    <div className="office-demo" ref={setHostEl}>
      {mounted ? (
        <Suspense fallback={placeholder}>
          <OfficeBuilder
            initialLayout={DEMO_LAYOUT}
            workers={DEMO_WORKERS}
            onSave={() => {}}
            saveState="idle"
            showcase
          />
        </Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}

/**
 * The security section's showcase (#security): a live 3D vignette - one
 * portlet at a desk, a pipe that connects to Shopify and one that Xero's
 * permission block stops short. Same lazy-mount pattern as the office
 * showcase: the three.js chunk isn't fetched until the section nears the
 * viewport.
 */
function SecurityShowcase() {
  const [mounted, setMounted] = useState(false);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hostEl) return;
    if (!("IntersectionObserver" in window)) {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(hostEl);
    return () => io.disconnect();
  }, [hostEl]);

  const placeholder = (
    <div className="office-demo__placeholder">
      <span>Checking permissions…</span>
    </div>
  );

  return (
    <div ref={setHostEl}>
      {mounted ? <Suspense fallback={placeholder}><SecurityDemo /></Suspense> : placeholder}
    </div>
  );
}

/**
 * The integrations section's showcase (#integrations): a live 3D vignette -
 * one portlet at its desk, ringed by six platform cards, dotted lines
 * snaking across the floor to each and green messages firing down random
 * lines. Same lazy-mount pattern as the other showcases.
 */
function IntegrationsShowcase() {
  const [mounted, setMounted] = useState(false);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hostEl) return;
    if (!("IntersectionObserver" in window)) {
      setMounted(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(hostEl);
    return () => io.disconnect();
  }, [hostEl]);

  const placeholder = (
    <div className="office-demo__placeholder">
      <span>Plugging everything in…</span>
    </div>
  );

  return (
    <div ref={setHostEl}>
      {mounted ? <Suspense fallback={placeholder}><IntegrationsDemo /></Suspense> : placeholder}
    </div>
  );
}

function HomeHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // PORTARA-TEST: the header is not there at the top of the page; it rises
  // from under the hero's title as the page starts to scroll (nav-reveal.ts).
  const headerRef = useRef<HTMLElement>(null);
  useNavReveal(headerRef);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const LINKS = [
    { href: "#portal", label: "Custom Portal" },
    { href: "#portlets", label: "Portlets" },
    { href: "#how", label: "How it works" },
  ];

  // The header used to go transparent over the dark cover image. The page now
  // opens on the light brand sting, so it is always the glass bar.
  return (
    <header ref={headerRef} className={"site-header" + (scrolled ? " site-header--scrolled" : "")}>
      <div className="container site-header__inner">
        <a href="#main" className="site-header__logo" aria-label="Portara home">
          <img
            className="logo-img"
            src="/portara-test/brand/portara-lockup-horizontal-black-plain.svg"
            alt="Portara"
          />
        </a>

        <nav className="site-nav" aria-label="Primary">
          <ul className="site-nav__list">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="site-nav__link">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link to="/login" className="site-nav__link">
                Log in
              </Link>
            </li>
          </ul>
          <a href="#request" className="btn site-nav__cta">
            Request a meeting
          </a>
        </nav>

        <button
          type="button"
          className="site-header__toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="visually-hidden">
            {open ? "Close menu" : "Open menu"}
          </span>
          <span
            className={"burger" + (open ? " is-open" : "")}
            aria-hidden="true"
          >
            <span />
            <span />
          </span>
        </button>
      </div>

      <div id="mobile-menu" className={"mobile-menu" + (open ? " is-open" : "")}>
        <nav aria-label="Mobile" className="container">
          <ul className="mobile-menu__list">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="mobile-menu__link"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/login"
                className="mobile-menu__link"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            </li>
            <li>
              <a
                href="#request"
                className="mobile-menu__link"
                onClick={() => setOpen(false)}
              >
                Request a meeting
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

/**
 * PORTARA-TEST: the hero comes in two versions while the design is decided -
 * the 2D brand sting (hero-scene.tsx) and the 3D gate with its orbiting words
 * (hero-3d.tsx). A small switch pinned under the header picks one; the choice
 * sticks in localStorage. Switching scrolls to the top first so neither
 * hero's pinned scroll-trigger is torn down mid-flight.
 */
type HeroMode = "2d" | "3d";
const HERO_KEY = "portara-test:hero";
function readHeroMode(): HeroMode {
  try {
    return localStorage.getItem(HERO_KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

function HeroToggle({ mode, onChange }: { mode: HeroMode; onChange: (m: HeroMode) => void }) {
  return (
    <div className="hero-toggle" role="radiogroup" aria-label="Hero version">
      <span className="hero-toggle__label">Hero</span>
      <span className="hero-toggle__track">
        <span className={"hero-toggle__ink" + (mode === "3d" ? " is-right" : "")} aria-hidden="true" />
        {(["2d", "3d"] as HeroMode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={"hero-toggle__opt" + (mode === m ? " is-on" : "")}
            onClick={() => onChange(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </span>
    </div>
  );
}

/** While the 3D chunk loads: the same hero layout with an empty stage. */
function HeroLoading() {
  return (
    <section className="scene scene--3d scene--loading" aria-hidden="true">
      <div className="scene__hero">
        <div className="container scene__grid">
          <div className="scene__copy">
            <span className="eyebrow">Custom staff portals · Perth</span>
            <h1 className="scene__title">
              Put your business on <span className="hl-sand">autopilot</span>.
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [heroMode, setHeroMode] = useState<HeroMode>(readHeroMode);
  const chooseHero = (m: HeroMode) => {
    if (m === heroMode) return;
    try {
      localStorage.setItem(HERO_KEY, m);
    } catch {
      /* private mode: the choice just does not stick */
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    setHeroMode(m);
  };

  // PORTARA-TEST: local state stands in for useNavigation() + actionData.
  const [busy, setBusy] = useState(false);
  const [actionData, setActionData] = useState<LeadResult | null>(null);
  const submitted = actionData?.ok === true;
  const siteKey = turnstileSiteKey();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setActionData(await submitLead(new FormData(e.currentTarget)));
    setBusy(false);
  }

  return (
    <>
      <HomeHeader />

      <main id="main">
        {/* ----- Opening scene, in the version the toggle picks ----- */}
        <HeroToggle mode={heroMode} onChange={chooseHero} />
        {heroMode === "3d" ? (
          <Suspense fallback={<HeroLoading />}>
            <Hero3D key="3d" />
          </Suspense>
        ) : (
          <HeroScene key="2d" />
        )}

        {/* ----- Custom Portal: the toolbox that builds itself ----- */}
        <ToolboxBuilder />

        {/* ----- Portlets (our agents) ----- */}
        <section id="portlets" className="section">
          <div className="container">
            <SectionLabel title="Portlets" />
            <div className="feature">
              <OfficeShowcase />
              <Reveal className="stack">
                <span className="eyebrow">Your AI teammates</span>
                <RevealText>
                  Meet your <span className="hl">Portlets</span>.
                </RevealText>
                <p className="lead">
                  Claude-powered agents that live in your portal. Ask in plain
                  English. They log the lead, build the report, chase the quote.
                  No clicking around.
                </p>
                <ul className="ticklist">
                  <li>Powered by Claude</li>
                  <li>Run in plain English, no training</li>
                  <li>They do the busywork, you make the calls</li>
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ----- Integrations (connect anything) ----- */}
        <section id="integrations" className="section section--surface">
          <div className="container">
            <SectionLabel title="Integrations" />
            <div className="feature">
              <Reveal className="stack">
                <span className="eyebrow">Connect anything</span>
                <RevealText>
                  Plugs into <span className="hl">any platform</span> you use.
                </RevealText>
                <p className="lead">
                  Your portal talks to the tools you already run. Accounting,
                  CRM, email, calendars, payments, whatever you need. If it has
                  an API, we connect it.
                </p>
                <ul className="ticklist">
                  <li>Works with the software you already use</li>
                  <li>Your Portlets can use these tools on your behalf</li>
                  <li>New integrations added as you grow</li>
                </ul>
              </Reveal>
              <IntegrationsShowcase />
            </div>
            <LogoMarquee />
          </div>
        </section>

        {/* ----- Security (roles & permissions) ----- */}
        <section id="security" className="section">
          <div className="container">
            <SectionLabel title="Security" />
            <div className="feature">
              <Reveal className="stack">
                <span className="eyebrow">Roles and permissions</span>
                <RevealText>
                  You decide who touches <span className="hl">what</span>.
                </RevealText>
                <p className="lead">
                  Set permissions to the exact level for every user and every
                  Portlet. Grant one tool, one action, one dataset, or the whole
                  portal. Full control, always yours.
                </p>
                <ul className="ticklist">
                  <li>Custom roles for each person and each agent</li>
                  <li>Scope every Portlet to only what it needs</li>
                  <li>Change or revoke access in one click</li>
                </ul>
              </Reveal>
              <SecurityShowcase />
            </div>
          </div>
        </section>

        {/* ----- How it works (four steps on a flow line) ----- */}
        <HowItWorks />

        {/* ----- Who you'll work with ----- */}
        {/* Deliberately between How it works and Request a meeting: you read
            the process, you meet the two people who run it, then you ask. */}
        <section id="team" className="section team2">
          <div className="container">
            <SectionLabel title="Who you'll work with" />
            <div className="team2__grid">
              <Reveal className="team2__intro stack">
                <span className="eyebrow">The team</span>
                <RevealText>
                  Two people. <span className="hl">No handover.</span>
                </RevealText>
                <p className="lead">
                  The person who sits down with you designs your portal, the
                  person who builds it runs it, and both of them pick up the
                  phone. No account managers.
                </p>
                <div className="team2__place">
                  <span className="minilabel">Perth, WA</span>
                  <span>
                    We meet you in person, and you deal with us directly for as
                    long as you're with us.
                  </span>
                </div>
              </Reveal>

              <Reveal as="ul" className="team2__people" stagger={0.16} y={40}>
                {TEAM.map((p) => (
                  <li key={p.name} className="team2__person">
                    <Portrait person={p} />
                    <h3 className="team2__name">{p.name}</h3>
                    <p className="team2__role minilabel">{p.role}</p>
                    <ul className="team2__does ticklist">
                      {p.does.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    {(p.credential || p.website || p.linkedin) && (
                      <div className="team2__proof">
                        {p.credential && (
                          <span className="person__cred">
                            {p.credential.logo()}
                            <span className="person__creddetail">
                              {p.credential.detail}
                            </span>
                          </span>
                        )}
                        {(p.website || p.linkedin) && (
                          <div className="team2__links">
                            {p.website && (
                              <a
                                className="person__profile"
                                href={p.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <SiteMark />
                                {p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              </a>
                            )}
                            {p.linkedin && (
                              <a
                                className="person__profile"
                                href={p.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LinkedInMark />
                                View profile
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </Reveal>
            </div>
          </div>
        </section>

        {/* ----- Request a meeting ----- */}
        <section id="request" className="section section--surface">
          <div className="container">
            <SectionLabel title="Request a meeting" />
            <div className="request">
              <Reveal className="request__pitch">
                <RevealText>
                  Let's build <span className="hl-sand">your portal</span>.
                </RevealText>
                <p className="lead">
                  Tell us how you work. We'll show you what a portal could do,
                  with fixed pricing and no jargon.
                </p>
                <ul className="ticklist">
                  <li>A free 30-minute chat, no pressure</li>
                  <li>An honest read on what a portal could do</li>
                  <li>Fixed pricing and a clear path to a build</li>
                </ul>
                <div className="request__contact">
                  <p className="minilabel">Prefer email</p>
                  <a className="link" href="mailto:enquiries@portara.com.au">
                    enquiries@portara.com.au
                  </a>
                </div>
              </Reveal>

              <Reveal className="request__form" self>
                {submitted ? (
                  <div className="form-success stack">
                    <span
                      className="eyebrow"
                      style={{ color: "var(--success)" }}
                    >
                      Received
                    </span>
                    <h3>Thanks, we'll be in touch.</h3>
                    <p style={{ color: "var(--slate-300)" }}>
                      We've got your details and we'll be in touch shortly to set
                      up your meeting. If it's urgent, email us at{" "}
                      <a className="link" href="mailto:enquiries@portara.com.au">
                        enquiries@portara.com.au
                      </a>
                      .
                    </p>
                  </div>
                ) : (
                  <form className="form" method="post" onSubmit={onSubmit}>
                    {/* Honeypot - hidden from real users. */}
                    <input
                      type="text"
                      name="company_website"
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      style={{ display: "none" }}
                    />

                    <div className="form__row">
                      <div className="field">
                        <label htmlFor="name">Name *</label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          autoComplete="name"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="email">Email *</label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div className="form__row">
                      <div className="field">
                        <label htmlFor="business_name">Business name</label>
                        <input
                          id="business_name"
                          name="business_name"
                          type="text"
                          autoComplete="organization"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="phone">Phone</label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="industry">Industry</label>
                      <select id="industry" name="industry" defaultValue="">
                        <option value="">Choose an industry</option>
                        {INDUSTRIES.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="message">
                        What would you like your portal to do?
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        placeholder="e.g. track leads and quotes, manage the staff roster, see this month's revenue at a glance…"
                      />
                    </div>

                    {siteKey && <TurnstileWidget siteKey={siteKey} />}

                    {actionData?.ok === false && (
                      <p
                        className="form__note"
                        style={{ color: "var(--error)" }}
                      >
                        {actionData.error}
                      </p>
                    )}

                    <div>
                      <Magnet padding={40} magnetStrength={10} wrapperClassName="magnet">
                        <button type="submit" className="btn" disabled={busy}>
                          {busy ? "Sending…" : "Request a meeting"}
                        </button>
                      </Magnet>
                      <p
                        className="form__note"
                        style={{ marginTop: "var(--s-3)" }}
                      >
                        We'll reply within one business day.
                      </p>
                    </div>
                  </form>
                )}
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ----- Footer ----- */}
      <footer className="site-footer panel-slate">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            {/* The footer panel is permanently slate, so it loads the white
                lockup directly rather than filtering the black one. */}
            <img
              className="logo-img"
              src="/portara-test/brand/portara-lockup-horizontal-white.svg"
              alt="Portara"
            />
            <p className="site-footer__tagline">
              Custom staff portals for local business. A dashboard, the tools
              you use, and Claude to run it all.
            </p>
          </div>

          <nav className="site-footer__cols" aria-label="Footer">
            <div>
              <p className="site-footer__heading">Explore</p>
              <ul className="stack-sm">
                <li>
                  <a className="site-footer__link" href="#portlets">
                    Portlets
                  </a>
                </li>
                <li>
                  <a className="site-footer__link" href="#how">
                    How it works
                  </a>
                </li>
                <li>
                  <a className="site-footer__link" href="#team">
                    Who you'll work with
                  </a>
                </li>
                <li>
                  <a className="site-footer__link" href="#request">
                    Request a meeting
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="site-footer__heading">Access</p>
              <ul className="stack-sm">
                <li>
                  <Link className="site-footer__link" to="/login">
                    Client log in
                  </Link>
                </li>
                <li>
                  <Link className="site-footer__link" to="/signup">
                    Found your business
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="site-footer__heading">Studio</p>
              <ul className="stack-sm">
                <li className="site-footer__muted">Perth, WA</li>
                <li className="site-footer__muted">Working with local business</li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="container site-footer__legal">
          <span>© 2026 Portara. All rights reserved.</span>
          {/* The legal bar, not a nav column: a privacy policy is not a
              feature to explore, it is the thing a person looks for at the
              bottom of the page when they want to know what happens to their
              details. It is also the link APP 1.3 is about - the policy has
              to be available free of charge, so it sits on every page of the
              site that carries this footer, ahead of any login. The terms
              sit beside it for the same reason, and because Google's OAuth
              consent screen links to them. */}
          <span className="site-footer__legal-links">
            <Link className="site-footer__link" to="/privacy">
              Privacy Policy
            </Link>
            <Link className="site-footer__link" to="/terms">
              Terms of Service
            </Link>
          </span>
          <span className="text-mono">portara.com.au</span>
        </div>
      </footer>
    </>
  );
}
