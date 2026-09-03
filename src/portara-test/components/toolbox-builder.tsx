/**
 * The Custom Portal section: a toolbox that builds itself.
 *
 * A fragment of the real portal - the product's own top bar and toolbox rail
 * (portal.css classes, the same ones the workspace tour renders), a dashboard
 * beside them - next to a row of industry tabs. Pick an industry and the
 * portal re-dresses for it in one choreographed pass: the tab indicator
 * slides, the rail's tools fly between the shelf underneath and the rail
 * (gsap Flip), the header and switcher swap with a lift, the dashboard's
 * figures count to the new values and its record bars re-stretch. Any tool
 * can be tapped to swap it in or out. Left alone it cycles through the
 * industries on its own while on screen, a thin timer under the tabs showing
 * when, and stops for good the moment someone touches it.
 *
 * It says what the statement it replaced said, without the paragraph: the
 * portal is built from the tools your business actually runs on.
 *
 * The figures are illustrative and say so under the frame. Reduced motion:
 * no Flip, no counting, no cycling - the DOM just changes.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBarChart2,
  FiBookOpen,
  FiBox,
  FiBriefcase,
  FiCalendar,
  FiClipboard,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiFolder,
  FiHeart,
  FiHome,
  FiLayers,
  FiMail,
  FiPackage,
  FiPercent,
  FiPhoneCall,
  FiRepeat,
  FiRotateCcw,
  FiShield,
  FiShoppingCart,
  FiStar,
  FiTag,
  FiTool,
  FiTrendingUp,
  FiTruck,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { RevealText } from "./reveal";
import { SectionRule } from "./section-rule";

gsap.registerPlugin(Flip, ScrollTrigger);

type Tool = { id: string; label: string; icon: IconType };

const TOOL_LIST: Tool[] = [
  { id: "workorders", label: "Work orders", icon: FiClipboard },
  { id: "crew", label: "Crew", icon: FiUsers },
  { id: "compliance", label: "Compliance", icon: FiShield },
  { id: "bids", label: "Bid desk", icon: FiFileText },
  { id: "contracts", label: "Contracts", icon: FiBriefcase },
  { id: "assets", label: "Assets", icon: FiTool },
  { id: "orders", label: "Orders", icon: FiShoppingCart },
  { id: "inventory", label: "Inventory", icon: FiPackage },
  { id: "returns", label: "Returns", icon: FiRotateCcw },
  { id: "customers", label: "Customers", icon: FiUserCheck },
  { id: "promotions", label: "Promotions", icon: FiTag },
  { id: "suppliers", label: "Suppliers", icon: FiTruck },
  { id: "clients", label: "Clients", icon: FiBriefcase },
  { id: "projects", label: "Projects", icon: FiLayers },
  { id: "timesheets", label: "Timesheets", icon: FiClock },
  { id: "invoices", label: "Invoices", icon: FiDollarSign },
  { id: "documents", label: "Documents", icon: FiFolder },
  { id: "pipeline", label: "Pipeline", icon: FiTrendingUp },
  { id: "appointments", label: "Appointments", icon: FiCalendar },
  { id: "patients", label: "Patients", icon: FiHeart },
  { id: "recalls", label: "Recalls", icon: FiPhoneCall },
  { id: "referrals", label: "Referrals", icon: FiMail },
  { id: "billing", label: "Billing", icon: FiCreditCard },
  { id: "roster", label: "Roster", icon: FiRepeat },
  { id: "bookings", label: "Bookings", icon: FiBookOpen },
  { id: "stock", label: "Stock", icon: FiBox },
  { id: "events", label: "Events", icon: FiStar },
  { id: "reviews", label: "Reviews", icon: FiActivity },
  { id: "reports", label: "Reports", icon: FiBarChart2 },
  { id: "margins", label: "Margins", icon: FiPercent },
];
const TOOLS: Record<string, Tool> = Object.fromEntries(TOOL_LIST.map((t) => [t.id, t]));

type Preset = {
  id: string;
  label: string;
  business: string;
  short: string;
  sub: string;
  tools: string[];
  kpis: { label: string; value: number }[];
  /** Widths, in %, of the three placeholder record bars. */
  bars: [number, number, number];
};

const PRESETS: Preset[] = [
  {
    id: "trades",
    label: "Trades and construction",
    business: "Kestrel Electrical",
    short: "Site overview",
    sub: "Every job on the ground, this fortnight.",
    tools: ["workorders", "crew", "compliance", "bids", "contracts", "assets"],
    kpis: [
      { label: "Open work orders", value: 12 },
      { label: "Crew on site today", value: 18 },
      { label: "Certs expiring", value: 3 },
    ],
    bars: [46, 62, 30],
  },
  {
    id: "retail",
    label: "Retail and e-commerce",
    business: "Harbourside Goods",
    short: "Trading today",
    sub: "Orders, stock and returns, live from the store.",
    tools: ["orders", "inventory", "returns", "customers", "promotions", "suppliers"],
    kpis: [
      { label: "Orders today", value: 46 },
      { label: "Low-stock lines", value: 7 },
      { label: "Returns open", value: 4 },
    ],
    bars: [70, 38, 54],
  },
  {
    id: "services",
    label: "Professional services",
    business: "Fenwick and Rowe",
    short: "This week",
    sub: "Matters, hours and the invoices behind them.",
    tools: ["clients", "projects", "timesheets", "invoices", "documents", "pipeline"],
    kpis: [
      { label: "Active matters", value: 23 },
      { label: "Hours logged", value: 164 },
      { label: "Invoices due", value: 9 },
    ],
    bars: [34, 58, 66],
  },
  {
    id: "health",
    label: "Health and allied care",
    business: "Cottesloe Physio",
    short: "Clinic today",
    sub: "The day's list, recalls and claims in one view.",
    tools: ["appointments", "patients", "recalls", "referrals", "billing", "roster"],
    kpis: [
      { label: "Appointments", value: 31 },
      { label: "Recalls due", value: 14 },
      { label: "Claims to lodge", value: 6 },
    ],
    bars: [58, 44, 36],
  },
  {
    id: "hospitality",
    label: "Hospitality",
    business: "The Corner Room",
    short: "Tonight",
    sub: "Covers, the floor roster and what needs reordering.",
    tools: ["bookings", "roster", "stock", "suppliers", "events", "reviews"],
    kpis: [
      { label: "Covers booked", value: 86 },
      { label: "On shift", value: 11 },
      { label: "Lines to reorder", value: 5 },
    ],
    bars: [64, 28, 48],
  },
];

const REDUCE = "(prefers-reduced-motion: reduce)";
const CYCLE_MS = 4600;

function RailTool({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <li data-flip-id={tool.id}>
      <button
        type="button"
        className="px-sidelink mini__tool"
        onClick={onClick}
        aria-label={`Remove ${tool.label}`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {tool.label}
      </button>
    </li>
  );
}

function ShelfTool({ tool, onClick }: { tool: Tool; onClick: () => void }) {
  const Icon = tool.icon;
  return (
    <li data-flip-id={tool.id}>
      <button type="button" className="mini__chip" onClick={onClick} aria-label={`Add ${tool.label}`}>
        <Icon aria-hidden="true" />
        {tool.label}
      </button>
    </li>
  );
}

export function ToolboxBuilder() {
  const rootRef = useRef<HTMLElement>(null);
  const kpiRefs = useRef<(HTMLElement | null)[]>([]);
  const flipState = useRef<Flip.FlipState | null>(null);
  const idxRef = useRef(0);
  const lastPreset = useRef(0);

  const [presetIdx, setPresetIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>(PRESETS[0].tools);
  const [touched, setTouched] = useState(false);
  const preset = PRESETS[presetIdx];

  const reduce = () => window.matchMedia(REDUCE).matches;

  // Snapshot every tool's position before a change, so Flip can animate from it.
  const capture = () => {
    const root = rootRef.current;
    if (root && !reduce()) {
      flipState.current = Flip.getState(root.querySelectorAll("[data-flip-id]"));
    }
  };
  const choosePreset = (i: number, byUser: boolean) => {
    if (byUser) setTouched(true);
    if (i === idxRef.current && !byUser) return;
    capture();
    idxRef.current = i;
    setPresetIdx(i);
    setSelected(PRESETS[i].tools);
  };
  const toggle = (id: string) => {
    setTouched(true);
    capture();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  // The tab indicator follows the active tab.
  const placeInk = (animate: boolean) => {
    const root = rootRef.current;
    if (!root) return;
    const ink = root.querySelector<HTMLElement>(".builder__ink");
    const tab = root.querySelectorAll<HTMLElement>(".builder__tab")[idxRef.current];
    if (!ink || !tab) return;
    const vars = { x: tab.offsetLeft, y: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight };
    if (animate && !reduce()) gsap.to(ink, { ...vars, duration: 0.55, ease: "power3.inOut", overwrite: true });
    else gsap.set(ink, vars);
  };

  // After React has moved the tools: the whole change, choreographed.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    placeInk(true);

    const state = flipState.current;
    flipState.current = null;
    const presetChanged = lastPreset.current !== presetIdx;
    lastPreset.current = presetIdx;

    if (reduce()) {
      preset.kpis.forEach((k, i) => {
        const el = kpiRefs.current[i];
        if (el) el.textContent = String(k.value);
      });
      root.querySelectorAll<HTMLElement>(".mini__bar").forEach((b, i) => {
        b.style.width = `${preset.bars[i]}%`;
      });
      return;
    }

    const tl = gsap.timeline();
    if (state) {
      tl.add(
        Flip.from(state, {
          targets: root.querySelectorAll("[data-flip-id]"),
          duration: 0.7,
          ease: "power2.inOut",
          absolute: true,
          nested: true,
          stagger: { each: 0.012, from: "start" },
        }),
        0,
      );
    }
    if (presetChanged) {
      const lift = root.querySelectorAll(".mini__lift");
      tl.fromTo(lift, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out", stagger: 0.05 }, 0.15);
    }
    // Figures count to the new values; gsap owns the text (React renders a
    // constant), so the two never fight.
    preset.kpis.forEach((k, i) => {
      const el = kpiRefs.current[i];
      if (!el) return;
      const o = { v: Number(el.textContent) || 0 };
      tl.to(
        o,
        {
          v: k.value,
          duration: 0.9,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = String(Math.round(o.v));
          },
        },
        0.1,
      );
    });
    root.querySelectorAll<HTMLElement>(".mini__bar").forEach((b, i) => {
      tl.to(b, { width: `${preset.bars[i]}%`, duration: 0.8, ease: "power3.inOut" }, 0.1 + i * 0.06);
    });
    return () => {
      tl.kill();
    };
  }, [selected, presetIdx, preset]);

  // First arrival: the rail assembles and the tiles rise, once, as the
  // section scrolls in.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduce()) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: root.querySelector(".mini"), start: "top 80%", once: true } });
    tl.from(root.querySelectorAll(".mini__tools li"), { x: -16, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.06, clearProps: "all" }, 0)
      .from(root.querySelectorAll(".mini__kpi"), { y: 16, autoAlpha: 0, duration: 0.6, ease: "power3.out", stagger: 0.08, clearProps: "all" }, 0.15)
      .from(root.querySelectorAll(".mini__row"), { scaleX: 0.9, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.06, transformOrigin: "left center", clearProps: "all" }, 0.3);
    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  // Re-seat the indicator when the tabs rewrap.
  useEffect(() => {
    const onResize = () => placeInk(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle presets while on screen, until the first interaction. The timer bar
  // under the tabs fills across each cycle.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || touched || reduce()) return;
    const bar = root.querySelector<HTMLElement>(".builder__timer i");
    let visible = false;
    let fill: gsap.core.Tween | null = null;
    const arm = () => {
      fill?.kill();
      if (!bar) return;
      fill = gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: CYCLE_MS / 1000, ease: "none", transformOrigin: "left center" });
    };
    const io = new IntersectionObserver(
      (entries) => {
        const now = entries.some((e) => e.isIntersecting);
        if (now && !visible) arm();
        if (!now) fill?.pause();
        else fill?.resume();
        visible = now;
      },
      { threshold: 0.3 },
    );
    io.observe(root);
    const timer = setInterval(() => {
      if (!visible || document.hidden) return;
      choosePreset((idxRef.current + 1) % PRESETS.length, false);
      arm();
    }, CYCLE_MS);
    return () => {
      io.disconnect();
      clearInterval(timer);
      fill?.kill();
      if (bar) gsap.set(bar, { scaleX: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touched]);

  const pool = TOOL_LIST.filter((t) => !selected.includes(t.id));

  return (
    <section id="portal" className="section section--surface builder" ref={rootRef}>
      <div className="container">
        <SectionRule title="Custom Portal" />

        <div className="builder__grid">
          <div className="builder__copy">
            <span className="eyebrow">Your workspace</span>
            <RevealText>
              One portal. <span className="hl">Your tools.</span>
            </RevealText>
            <p className="lead">
              Pick an industry and watch the toolbox build itself. Your portal
              gets the tools your business runs on, and nothing it doesn't.
            </p>
            <div className="builder__tabwrap">
              <div className="builder__tabs" role="tablist" aria-label="Industry">
                <span className="builder__ink" aria-hidden="true" />
                {PRESETS.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={i === presetIdx}
                    className={"builder__tab" + (i === presetIdx ? " is-active" : "")}
                    onClick={() => choosePreset(i, true)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className={"builder__timer" + (touched ? " is-off" : "")} aria-hidden="true">
                <i />
              </span>
            </div>
            <p className="builder__hint minilabel">Tap any tool to swap it in or out</p>
          </div>

          <div className="builder__stage">
            {/* A fragment of the product, on the product's own stylesheet. */}
            <div className="px-scope mini" aria-label={`A portal for ${preset.label.toLowerCase()}`}>
              <header className="px-topbar">
                <div className="px-topbar__inner">
                  <span className="px-brand">
                    <img src="/portara-test/brand/portara-lockup-horizontal-black-plain.svg" alt="" />
                  </span>
                  <nav className="px-nav" aria-hidden="true">
                    <span className="px-navlink is-active">Portal</span>
                    <span className="px-navlink">Office</span>
                    <span className="px-navlink">Settings</span>
                  </nav>
                  <span className="px-switcher__btn mini__lift">
                    <span className="px-switcher__name">{preset.business}</span>
                  </span>
                  <div className="px-topbar__spacer" />
                  <div className="px-topbar__right">
                    <span className="tour__avatar">DM</span>
                    <span className="tour__me">Dave M.</span>
                  </div>
                </div>
              </header>

              <div className="px-portal mini__body">
                <aside className="px-toolbox mini__rail">
                  <span className="px-sidelink is-active mini__fixed">
                    <FiHome className="size-4 shrink-0" aria-hidden="true" />
                    Dashboard
                  </span>
                  <span className="px-toolbox__heading">Toolbox</span>
                  <ul className="mini__tools" aria-label="Toolbox">
                    {selected.map((id) => (
                      <RailTool key={id} tool={TOOLS[id]} onClick={() => toggle(id)} />
                    ))}
                  </ul>
                </aside>

                <main className="px-portal__main mini__main">
                  <div className="px-shell px-shell--fluid">
                    <div className="px-header">
                      <div className="mini__lift">
                        <span className="px-eyebrow">Dashboard</span>
                        <h1 className="px-title">{preset.short}</h1>
                        <p className="px-sub">{preset.sub}</p>
                      </div>
                    </div>
                    <ul className="mini__kpis">
                      {preset.kpis.map((k, i) => (
                        <li key={i} className="mini__kpi">
                          <span
                            className="mini__kpi-val"
                            ref={(el) => {
                              kpiRefs.current[i] = el;
                            }}
                          >
                            {PRESETS[0].kpis[i].value}
                          </span>
                          <span className="mini__kpi-label mini__lift">{k.label}</span>
                        </li>
                      ))}
                    </ul>
                    <ul className="mini__rows" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <li key={i} className="mini__row">
                          <span className="mini__bar" style={{ width: `${PRESETS[0].bars[i]}%` }} />
                          <span className="mini__pill" />
                        </li>
                      ))}
                    </ul>
                  </div>
                </main>
              </div>
            </div>

            <div className="builder__shelf">
              <span className="minilabel">More tools</span>
              <ul className="builder__pool">
                {pool.map((t) => (
                  <ShelfTool key={t.id} tool={t} onClick={() => toggle(t.id)} />
                ))}
              </ul>
            </div>
            <p className="builder__note">
              Illustrative. Every portal is built from your data, with your names
              for things.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
