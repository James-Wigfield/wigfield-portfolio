// The workspace tour (#portal, landing page) - the section's whole showcase.
//
// TWO ACTS, ONE STAGE. Act one is a faithful recreation of a real client
// portal with a cursor driving it: the camera pushes in once and then travels
// down the toolbox, and clicks through a run of pages while the view under it
// changes. Act two opens a 3D portlet's office OVER THE SAME PAGE, beside the
// same rail, and fires packets of work into the very rows the cursor was just
// pressing - the section's claim ("your workspace, and the agents that run
// it") argued in pictures rather than in adjectives.
//
// WHY A RECREATION AND NOT A SCREENSHOT. The tour zooms to 2x and holds there.
// A PNG is mush at that scale, and a cursor cannot click one. This is the real
// portal.css - the same .px-topbar, .px-toolbox, .px-sidelink and .px-tool the
// product ships - laid out at a fixed 1240 wide and scaled to the stage, so
// what a visitor sees IS the product's own stylesheet, vector-sharp at any
// zoom. The tenant is demo-industrial-contractor: its actual toolbox, its
// actual pages.
//
// THE CURSOR POINTS AT WHAT IT PRESSES, and it does that because the shot list
// names TARGETS rather than coordinates: every row carries a `data-tgt`, and
// after layout each one is measured out of the DOM into world pixels (see
// measureTargets). The first cut hand-computed those positions from the CSS -
// padding plus line-height plus flex gap, per row, by arithmetic - and every
// one of them was wrong, because inherited line-height alone moved each row by
// six pixels and the error accumulated all the way down the rail. Nothing here
// guesses at layout any more; a change to portal.css moves the cursor with it.
//
// ONE WORLD, BOTH ACTS. Act two was once a second layer that cross-faded in,
// carrying its own copy of the toolbox and its own copy of the geometry - and
// that is precisely how it came to be laid out against a document height the
// window no longer had, and rendered off the bottom of the frame. It is an
// overlay on the page now. The rows the packets land in are the same DOM the
// cursor was driving a moment ago, so they cannot be a different size, in a
// different place, or absent; and "the agent drives the same UI you just
// watched a person drive" is true of the markup, not only of the copy.
//
// THE CAMERA. One transform on one element, tweened by CSS between scripted
// shots (see SHOTS). No rAF loop, no per-frame React: the compositor does the
// work, and the whole of act one costs one setTimeout per shot. Act two's
// delivery beats are CSS animations on a delay, so they cost nothing at all.
//
// It never runs unseen: nothing starts until the section is in view, and
// prefers-reduced-motion gets the establishing frame and no motion at all.
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  FiActivity,
  FiBriefcase,
  FiChevronRight,
  FiClipboard,
  FiFileText,
  FiHome,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import { chestInBox } from "../portal-ui/components/office3d/workspace-room";

import { AS_OF, TOUR_PAGES, type TourRoute } from "./workspace-tour-pages";

const WorkspaceDemo = lazy(
  () => import("../portal-ui/components/office3d/workspace-demo"),
);

/* â”€â”€ The stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** The portal's page is laid out at this width and scaled to the stage, so
    every camera coordinate below is a pixel position on the page as designed. */
const PORTAL_W = 1240;
/**
 * The height of the WINDOW onto that page - not of the page itself.
 *
 * With every toolbox section expanded the document is a good deal taller than
 * this, and that is correct rather than a problem: a browser shows the top of
 * a long page and you travel down it. Zoom 1 means "fits the width, cropped at
 * the fold", exactly like the real thing.
 *
 * A FALLBACK, not a fact: the stage carries its aspect in CSS and the phone
 * cut is a taller box, so the live value is measured off the stage and every
 * vertical number below is derived from that. Hard-coding it is what made the
 * office frame itself against one shape of screen and drift on every other.
 */
const VIEW_H = 776;
/** Fallback document height until the real one is measured. */
const DOC_H_GUESS = 1010;

/** The top bar's height, and where the toolbox ends - the page body the
    portlet's room takes over starts at that corner. Layout constants of the
    recreated portal, not of the camera. */
const TOPBAR_H = 56;
const RAIL_W = 216;

/* â”€â”€ The tenant, as it actually is â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** A page the tour visits. Tool index pages are `<tool>/index`, which is the
    same key shape the toolbox uses for its rows, so a route IS a target - and
    the same key the snapshot in workspace-tour-pages.tsx is filed under. */
type RouteId = TourRoute;

const TOOLS = [
  {
    id: "works",
    label: "Work orders",
    Icon: FiClipboard,
    subtabs: [
      { path: "index", label: "Board" },
      { path: "schedule", label: "Schedule" },
      { path: "cost", label: "Cost" },
    ],
  },
  {
    id: "crew",
    label: "Crew",
    Icon: FiUsers,
    subtabs: [
      { path: "index", label: "Register" },
      { path: "tickets", label: "Tickets" },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    Icon: FiShield,
    subtabs: [
      { path: "index", label: "Expiry board" },
      { path: "access", label: "Site access" },
    ],
  },
  {
    id: "biddesk",
    label: "Bid desk",
    Icon: FiFileText,
    subtabs: [
      { path: "index", label: "Pipeline" },
      { path: "closing", label: "Closing soon" },
      { path: "decided", label: "Decided" },
    ],
  },
  {
    id: "contracts",
    label: "Contracts",
    Icon: FiBriefcase,
    subtabs: [
      { path: "index", label: "Clients" },
      { path: "orders", label: "Purchase orders" },
      { path: "variations", label: "Variations" },
    ],
  },
  {
    id: "assets",
    label: "Assets",
    Icon: FiActivity,
    subtabs: [
      { path: "index", label: "Register" },
      { path: "due", label: "Due" },
    ],
  },
];

/**
 * What the portlet delivers in act two, and WHERE.
 *
 * Each one lands on the exact page its work belongs to - a raised work order
 * on the Board, a checked licence on Crew/Tickets, a cleared mobilisation on
 * Compliance/Site access - rather than on the tool heading above it. A packet
 * arriving at "Contracts" says the agent touched something over there
 * somewhere; a packet arriving at "Variations" says what it did.
 *
 * Listed in rail order, top to bottom, because that is the order they fire in
 * and a delivery run that jumps back up the nav reads as a shuffle.
 *
 * All six sit in the top screenful of the rail, and that is a constraint, not
 * a coincidence: act two holds the top of the page (see the shot list), so a
 * delivery aimed at Assets - three quarters of the way down a rail half again
 * as tall as the frame - would be a packet flying off the bottom of the
 * picture to tick a row nobody can see. The director filters to what is
 * actually on screen regardless; this list is what makes that filter a
 * formality rather than the thing quietly dropping a third of the act.
 */
const DELIVERIES = [
  { to: "works/index", got: "3 work orders raised" },
  { to: "works/cost", got: "$6,392 of overrun flagged" },
  { to: "crew/tickets", got: "12 tickets checked" },
  { to: "compliance/access", got: "2 mobilisations cleared" },
  { to: "biddesk/index", got: "4 RFQs logged" },
  { to: "contracts/index", got: "2 client records updated" },
];

/** Clearance a row needs from the edges of the frame before a packet may be
    sent to it. A tick appearing on a row half cut off by the bottom of the
    picture is worse than no tick. */
const LAND_MARGIN = 10;

/* â”€â”€ The shot list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

type Shot = {
  /** Milliseconds from the top of the loop. */
  at: number;
  /** How long the move into this shot takes. 0 = cut. */
  ms: number;
  /** How far in. 1 = the page's full width, cropped at the fold. */
  zoom: number;
  /** The row the cursor rests on. Resolved from the DOM, never guessed - and
      it lights that row as hovered, so what is highlighted and what is under
      the pointer cannot disagree. */
  target?: string;
  /** Camera centre, for shots that frame something other than the target. */
  focus?: [number, number];
  /** Track the target's height with the camera - the descent. */
  follow?: boolean;
  /** Where the cursor idles when there is no target. */
  cursor?: [number, number];
  /** The cursor presses on arrival. */
  click?: boolean;
  /**
   * The page the main area shows FROM THIS SHOT ON.
   *
   * Only stated when it changes; ROUTE_AT below carries it forward. Declaring
   * it per shot meant every shot that forgot to restate it fell back to the
   * dashboard, and the descent's six shots did exactly that.
   */
  route?: RouteId;
  /** Hand over to the agent's act. */
  act2?: boolean;
};

/** The five pages the demo actually opens, in the order the rail passes them.
    Every one is a SUBTAB: a tool's own index is a landing page, and clicking
    "Schedule" or "Purchase orders" is what using the thing looks like. */
const CLICK_RUN: RouteId[] = [
  "works/schedule",
  "works/cost",
  "crew/index",
  "biddesk/closing",
  "contracts/orders",
];

/** The bottom of the rail - the last row there is, so the glide finishes by
    having shown every route rather than stopping at the last tool head. */
const RAIL_END = `${TOOLS[TOOLS.length - 1].id}/${
  TOOLS[TOOLS.length - 1].subtabs[TOOLS[TOOLS.length - 1].subtabs.length - 1].path
}`;

/**
 * One page opened: TRAVEL, then PRESS.
 *
 * Two shots, not one, because a shot's state applies for its whole duration -
 * so a single shot that both moved the cursor and changed the route changed
 * the route at the instant the cursor set OFF, and the page was always already
 * the new one by the time the pointer arrived. The press is a zero-length shot
 * scheduled for the moment the travel ends: the ring fires and the page turns
 * together, on arrival, which is what a click is.
 */
const openPage = (i: number, at: number): Shot[] => [
  { at, ms: 480, zoom: 1, target: CLICK_RUN[i], follow: true },
  {
    at: at + 500,
    ms: 0,
    zoom: 1,
    target: CLICK_RUN[i],
    follow: true,
    click: true,
    route: CLICK_RUN[i],
  },
];

const SHOTS: Shot[] = [
  // Establishing: the top of the page, as a window onto it.
  { at: 0, ms: 0, zoom: 1, cursor: [980, 620], route: "portal" },
  // ONE push in, onto the top of the railâ€¦
  { at: 1400, ms: 1150, zoom: 1.95, target: "dashboard", follow: true },
  // â€¦pressing Dashboard as it lands, not as it sets off.
  { at: 2600, ms: 0, zoom: 1.95, target: "dashboard", follow: true, click: true },
  // ...and ONE unbroken glide from there to the bottom of the rail. Six
  // discrete steps read as a stutter; a single long travel at a fixed zoom is
  // the move the section wants, and by the end it has shown every route there
  // is - the last subtab, not just the last tool.
  { at: 3100, ms: 3400, zoom: 1.95, target: RAIL_END, follow: true },
  // Then out to the whole page, and a beat to take the rail in as one thing
  // before anything is pressed.
  { at: 6800, ms: 1100, zoom: 1, cursor: [980, 620] },
  // Now the clicking starts, one page at a time.
  ...openPage(0, 8400),
  ...openPage(1, 9600),
  ...openPage(2, 10800),
  ...openPage(3, 12000),
  ...openPage(4, 13200),
  // Up to the top bar, and press Office. The hand-over is a NAVIGATION, not a
  // dissolve: Office is where the portlets are in the real product, so the
  // room that opens next is the page that tab actually leads to. It used to
  // end on a push into the page with the cursor parked over nothing, which
  // read as the tour losing interest before the cut.
  { at: 14600, ms: 900, zoom: 1, target: "nav-office", follow: true },
  { at: 15600, ms: 0, zoom: 1, target: "nav-office", follow: true, click: true },
  // Act two: the same toolbox - the very same rows, in the very same page -
  // fed by a portlet instead of a hand. The camera does NOT move for it. It
  // used to settle on the middle of the rail so all six delivery rows were in
  // frame at once, which meant the page crept downwards at the exact moment
  // the room opened - a scroll nobody asked for, under a cut. It holds the top
  // of the page instead, and the deliveries below work out which rows that
  // leaves on screen.
  { at: 15900, ms: 1000, zoom: 1, act2: true },
];

/** The route in force at each shot - the last one anybody declared. Resolved
    once, here, so no shot has to remember to repeat what it did not change. */
const ROUTE_AT: RouteId[] = (() => {
  let current: RouteId = "portal";
  return SHOTS.map((s) => (current = s.route ?? current));
})();

/** Act two's beats are CSS animations on a delay, so this is simply how long
    the tour holds on them before looping. */
const ACT2_MS = 7000;
const LOOP_MS = SHOTS[SHOTS.length - 1].at + ACT2_MS;

/** The stage has to be measured BEFORE paint or the first frame renders at
    the wrong scale - but this component server-renders, and useLayoutEffect on
    the server is a warning in every log. Same effect, no noise. */
const useMeasure = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Where the cursor's tip sits on a row: hard right, clear of the words.
 *
 * It used to sit over the label, which is where a real pointer would be and
 * exactly the wrong place for a product shot - the arrow covered the one thing
 * the descent exists to let you read. Inset from the RIGHT edge instead: still
 * unambiguously on the row (which is lit, and where the click ring fires), and
 * every label is legible for the whole shot.
 */
const TIP_FROM_RIGHT = 24;

/** Breathing space under the rail's last row - enough that it does not sit
    flush against the bottom of the frame, not enough to show the gutter. */
const RAIL_TAIL = 14;

/**
 * The systems a route can sit on top of, as their own marks.
 *
 * Four logos say "it plugs into what you already pay for" faster than any
 * clause naming them could, and these are the files the integrations strip
 * further down the page already ships - so nothing new is being claimed here,
 * and nothing new had to be drawn.
 */
const FRONTS = [
  { name: "Shopify", src: "/portara-test/integrations/shopify.svg" },
  { name: "Xero", src: "/portara-test/integrations/xero.svg" },
  { name: "PayPal", src: "/portara-test/integrations/paypal.svg" },
  { name: "HubSpot", src: "/portara-test/integrations/hubspot.svg" },
];

type Point = {
  x: number;
  y: number;
  /** The row's bottom edge. Only the last one on the rail is read, and it is
      what stops the camera travelling off the end of the toolbox. */
  bottom: number;
};

/**
 * Every `data-tgt` row's cursor point, in page pixels.
 *
 * Walks the offsetParent chain rather than reading getBoundingClientRect,
 * because the world this lives in is under a CSS transform: offsets are layout
 * values and come back in the page's own coordinates whatever the camera is
 * doing, where rects would have to be divided back out by the current scale.
 */
function measureTargets(world: HTMLElement): Record<string, Point> {
  const out: Record<string, Point> = {};
  world.querySelectorAll<HTMLElement>("[data-tgt]").forEach((el) => {
    let x = 0;
    let y = 0;
    let node: HTMLElement | null = el;
    while (node && node !== world) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    out[el.dataset.tgt!] = {
      x: x + Math.max(el.offsetWidth - TIP_FROM_RIGHT, el.offsetWidth * 0.6),
      y: y + el.offsetHeight / 2,
      bottom: y + el.offsetHeight,
    };
  });
  return out;
}

/* â”€â”€ The director â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

export function WorkspaceTour() {
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  // Defaults to the page's own width, which is what "not measured yet" should
  // look like: the server render (and a visitor with no JavaScript at all)
  // gets the portal at 1:1, cropped by the frame - a real screenshot - rather
  // than an empty white box waiting for a number.
  const [stageW, setStageW] = useState(PORTAL_W);
  /** The stage's real height. Its aspect is set in CSS and the phone cut is a
      taller box, so this is measured rather than assumed - every vertical
      number in the shot maths is derived from it. */
  const [stagePx, setStagePx] = useState(PORTAL_W * (VIEW_H / PORTAL_W));
  /** The document's real height, once it has one. Everything vertical clamps
      against this, so an expanded rail can be as tall as it likes. */
  const [docH, setDocH] = useState(DOC_H_GUESS);
  const [targets, setTargets] = useState<Record<string, Point>>({});
  const [live, setLive] = useState(false);
  const [still, setStill] = useState(false);
  const [i, setI] = useState(0);
  /** Bumped on every click so the press animation can re-fire. */
  const [press, setPress] = useState(0);
  /** Bumped each time act two starts, so its delivery animations replay. */
  const [pass, setPass] = useState(0);
  // The three.js chunk is fetched a shot before its turn so it is warm when
  // the camera hands over, and it NEVER unmounts again - scrolling away
  // mid-loop and back would otherwise tear down a canvas and rebuild it in
  // the one place the section is meant to feel expensive.
  const [needs3d, setNeeds3d] = useState(false);

  // Reduced motion: the establishing frame, and nothing moves. Read once, on
  // the client, so the server render is identical either way.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = () => setStill(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Nothing runs until the section is near the viewport - the tour is the
  // second-heaviest thing on the page and it is four screens down.
  useEffect(() => {
    if (!hostEl) return;
    if (!("IntersectionObserver" in window)) {
      setLive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setLive(entries.some((e) => e.isIntersecting)),
      { rootMargin: "300px" },
    );
    io.observe(hostEl);
    return () => io.disconnect();
  }, [hostEl]);

  // Two measurements, both taken from the DOM rather than assumed: what a page
  // pixel is worth on screen, and where everything the cursor visits actually
  // sits. Re-taken once the webfonts land, because Inter arriving after first
  // paint reflows every row in the rail.
  useMeasure(() => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;
    const remeasure = () => {
      setDocH(world.offsetHeight || DOC_H_GUESS);
      setTargets(measureTargets(world));
    };
    const ro = new ResizeObserver(([entry]) => {
      setStageW(entry.contentRect.width);
      setStagePx(entry.contentRect.height);
    });
    ro.observe(stage);
    const box = stage.getBoundingClientRect();
    setStageW(box.width);
    setStagePx(box.height);
    remeasure();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) remeasure();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, []);

  // One timeout per shot, chained. A rAF loop would cost a frame callback for
  // the whole time the page is open to move a transform CSS is already
  // tweening for free.
  useEffect(() => {
    if (!live || still) return;
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const step = () => {
      const shot = SHOTS[n];
      setI(n);
      if (shot.click) setPress((p) => p + 1);
      if (shot.act2) setPass((p) => p + 1);
      if (n >= SHOTS.length - 2) setNeeds3d(true);
      const next = (n + 1) % SHOTS.length;
      const wait = next === 0 ? LOOP_MS - shot.at : SHOTS[next].at - shot.at;
      n = next;
      timer = setTimeout(step, wait);
    };
    step();
    return () => clearTimeout(timer);
  }, [live, still]);

  // The window onto the page, in PAGE pixels, from the stage as it actually
  // measures. Everything vertical below is expressed against this rather than
  // against a constant, which is what lets one shot list serve a 16:10 desktop
  // frame and a portrait phone crop without a second set of numbers.
  const viewH = stageW > 0 ? PORTAL_W * (stagePx / stageW) : VIEW_H;

  const at = still ? 0 : i;
  const shot = SHOTS[at];
  const route = ROUTE_AT[at];
  const scale = (stageW / PORTAL_W) * shot.zoom;

  // Where the cursor is, and therefore where the camera looks. A shot that
  // names a target it cannot find yet (first paint, before measurement) falls
  // back to its own idle point rather than snapping to the origin.
  const aim = shot.target ? targets[shot.target] : undefined;
  const cursor = aim ?? {
    x: (shot.cursor ?? [PORTAL_W / 2, viewH / 2])[0],
    y: (shot.cursor ?? [PORTAL_W / 2, viewH / 2])[1],
  };
  const focusX = shot.focus?.[0] ?? (shot.follow ? 190 : PORTAL_W / 2);
  const focusY =
    shot.follow && aim ? aim.y : (shot.focus?.[1] ?? viewH / 2);

  // Clamp the camera so it can never frame the void outside the page: the
  // visible half-extent shrinks as the zoom grows, and the focus point rides
  // inside it. Without this the descent at 2x would show blank page down the
  // left-hand side, which is exactly where the eye is. The phone crop leans on
  // the same clamp: it asks for the page's top-left corner and is handed the
  // nearest framing that actually exists.
  const clamp = (v: number, half: number, span: number) =>
    half * 2 >= span ? span / 2 : Math.min(span - half, Math.max(half, v));
  const fx = clamp(focusX, PORTAL_W / (2 * shot.zoom), PORTAL_W);
  // Vertically the floor is the LAST ROW OF THE RAIL, not the bottom of the
  // document. The page runs on past the toolbox, and travelling into that gap
  // shows the nav simply stopping - an empty gutter where the thing the shot
  // is about used to be. So the descent runs out of road exactly where the
  // toolbox does, with one row's breathing space under it.
  const floor = Math.min(docH, (targets[RAIL_END]?.bottom ?? docH) + RAIL_TAIL);
  const fy = clamp(focusY, viewH / (2 * shot.zoom), floor);

  // Where the window's top edge falls on the page. The top bar rides this, so
  // it stays pinned however far down the camera travels - the same thing
  // `position: sticky` does in the real portal, done by hand because there is
  // no scrolling ancestor here for sticky to work against.
  const stickyTop = Math.max(0, fy - viewH / (2 * shot.zoom));

  const worldStyle = {
    transform: `translate(${stageW / 2 - fx * scale}px, ${stagePx / 2 - fy * scale}px) scale(${scale})`,
    transitionDuration: `${shot.ms}ms`,
  };

  // AND SO ARE THE DELIVERIES. Which rows are on screen is a fact about the
  // frame, not about the list - so rather than the camera being moved to suit
  // the deliveries (which is what dragged the page downwards under the cut),
  // the deliveries are the ones the frame happens to show. Whatever the
  // framing, a packet can only ever be sent somewhere you can watch it land.
  const winBottom = stickyTop + viewH / shot.zoom;
  const sends = DELIVERIES.filter((d) => {
    const row = targets[d.to];
    return (
      !!row &&
      row.y > stickyTop + LAND_MARGIN &&
      row.bottom < winBottom - LAND_MARGIN
    );
  });
  /** Which step of the stagger each landing row animates on. */
  const drops: Record<string, number> = {};
  sends.forEach((d, n) => (drops[d.to] = n));

  // THE ROOM IS FRAMED AGAINST WHAT YOU CAN SEE, not against the document.
  //
  // It used to fill the page body from the top bar to the bottom of a document
  // half again as tall as the window, and be centred in THAT - so the room sat
  // centred in a box whose middle was off the bottom of the frame, by an
  // amount that moved with the page's content and the shape of the screen.
  // This box is exactly the visible window minus the rail, so the room is
  // centred in the picture on every screen, by construction.
  const officeBox = {
    left: RAIL_W,
    top: stickyTop + TOPBAR_H,
    width: PORTAL_W - RAIL_W,
    height: Math.max(0, viewH / shot.zoom - TOPBAR_H),
  };
  // And the packets leave the agent's chest, projected out of the room's own
  // constants at the size that box actually is - not read off a pixel pair
  // tuned against some earlier shape of it.
  const chest = chestInBox(officeBox.width, officeBox.height);
  const flight = {
    x: officeBox.left + chest.x,
    y: officeBox.top + chest.y,
  };

  const act2 = !still && !!shot.act2;

  return (
    <div
      className="tour"
      ref={setHostEl}
      data-act={act2 ? "2" : "1"}
      data-live={live || undefined}
    >
      <div className="tour__frame">
        {/* Browser chrome. Not decoration: it is what tells a visitor that the
            thing being flown around is a real screen and not an illustration. */}
        <div className="tour__chrome">
          <span className="tour__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="tour__url">
            demo-industrial-contractor.portara.com.au
          </span>
        </div>

        {/* ONE world, both acts. Act two used to be a second layer that
            cross-faded in, laid out against its own copy of the geometry -
            which is how it ended up rendering off the bottom of a window that
            had since become shorter than the document. It is an overlay on the
            page now: the toolbox the packets land in is the same DOM the
            cursor was just driving, so it cannot be a different size, in a
            different place, or missing. */}
        <div className="tour__stage" ref={stageRef}>
          <div className="tour__world" style={worldStyle} ref={worldRef}>
            <PortalMock
              route={route}
              hover={act2 ? undefined : shot.target}
              drops={act2 ? drops : undefined}
              stickyTop={stickyTop}
              ms={shot.ms}
            />

            {needs3d && (
              <div className="tour2" data-playing={act2 || undefined}>
                {/* The window's body area, in page pixels - the room's frame
                    and the launcher both hang off this one box, so they can
                    never disagree about where the agent is. It rides the
                    camera's own duration rather than snapping, which keeps the
                    room glued to the middle of the frame while the shot that
                    hands over to it is still moving. */}
                <div
                  className="tour2__win"
                  style={
                    {
                      left: officeBox.left,
                      top: officeBox.top,
                      width: officeBox.width,
                      height: officeBox.height,
                      "--tour2-ms": `${shot.ms}ms`,
                    } as React.CSSProperties
                  }
                >
                  <div className="tour2__office">
                    <Suspense fallback={null}>
                      <WorkspaceDemo />
                    </Suspense>
                  </div>
                  <div
                    className="tour2__flight"
                    key={pass}
                    style={{ left: chest.x, top: chest.y }}
                    aria-hidden="true"
                  >
                  {DELIVERIES.map(({ to, got }, n) => {
                    const row = targets[to];
                    if (!row) return null;
                    const step = { "--i": n } as React.CSSProperties;
                    return (
                      <span key={to} className="tour2__send" style={step}>
                        {/* The pulse stays at the agent while the packet
                            leaves it, so each message reads as something the
                            portlet emitted rather than something that faded
                            in nearby and set off. */}
                        <b className="tour2__spark" />
                        <span
                          className="tour2__packet"
                          style={
                            {
                              "--tx": `${row.x - flight.x}px`,
                              "--ty": `${row.y - flight.y}px`,
                            } as React.CSSProperties
                          }
                        >
                          {got}
                        </span>
                      </span>
                    );
                    })}
                  </div>
                </div>
              </div>
            )}

            <span
              className="tour__cursor"
              data-off={act2 || undefined}
              style={{
                transform: `translate(${cursor.x}px, ${cursor.y}px)`,
                transitionDuration: `${shot.ms}ms`,
              }}
              aria-hidden="true"
            >
              <svg viewBox="0 0 20 22" width="20" height="22">
                <path
                  d="M2 1.4 17.2 12.1H10l-2.9 7.6z"
                  fill="#111315"
                  stroke="#fff"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              {shot.click && <b className="tour__ping" key={press} />}
            </span>
          </div>
        </div>
      </div>

      {/* One line: which act, what you are looking at, and that it is a demo.
          It used to carry a sentence per act plus a paragraph of disclaimer -
          three lines of caption under a picture that already explains itself. */}
      <p className="tour__caption">
        <span className="tour__caption-num">{act2 ? "02" : "01"}</span>
        <span className="tour__caption-url">
          demo-industrial-contractor.portara.com.au
        </span>
        <span className="tour__caption-tag">Demo account.</span>
      </p>

      {/* The margin notes.
          The one thing on screen that never moves is the rail down the left -
          the camera pans past it, zooms into it, and finally feeds it - so it
          is the one thing worth annotating, and the only free space beside it
          is the page gutter. On a wide screen these hang out there, written
          by hand and pointing back at the frame with a drawn brace each.

          Below 1600px there is no gutter to hang in, so they fold into a plain
          two-up under the caption: same words, no drawing. Nothing here is
          load-bearing for the tour, which is why it can be dropped that
          cheaply. */}
      <aside className="tour-notes" aria-label="About the toolbox">
        <div className="tour-note" style={{ "--n": 0 } as React.CSSProperties}>
          <div className="tour-note__ink">
            <span className="tour-note__kicker">Custom tools</span>
            <p className="tour-note__body">
              You tell us what you need. We build it.
            </p>
          </div>
          <Brace />
        </div>
        <div className="tour-note" style={{ "--n": 1 } as React.CSSProperties}>
          <div className="tour-note__ink">
            <span className="tour-note__kicker">Or a layer on top</span>
            <p className="tour-note__body">
              A tool can front a system you already run. Your data, one login,
              nothing to migrate.
            </p>
            <span className="tour-note__logos">
              {FRONTS.map(({ name, src }) => (
                <b key={name} className="tour-note__logo" title={name}>
                  <img src={src} alt={name} loading="lazy" />
                </b>
              ))}
            </span>
          </div>
          <Brace />
        </div>
      </aside>
    </div>
  );
}

/* â”€â”€ The margin notes' pen strokes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/**
 * A hand-drawn curly brace, tip toward the words, arms toward the rail.
 *
 * That orientation is the whole grammar of an annotation: the open side
 * gathers up the thing being labelled and the point indicates the label. A
 * brace facing the other way would be pointing at the toolbox and gathering up
 * a sentence, which is the diagram drawn backwards.
 *
 * TWO PASSES, not one. A single geometric curve reads as a bracket glyph; a
 * pen goes over its own line and never quite retraces it, so the second path
 * is the first one redrawn slightly off and faint. Every control point is
 * deliberately a little asymmetric top-to-bottom for the same reason.
 *
 * `pathLength="1"` normalises the stroke so the draw-on animation in home.css
 * is one dash offset from 1 to 0, whatever the note's height stretches this
 * to; `non-scaling-stroke` keeps the nib the same weight while it stretches.
 */
function Brace() {
  return (
    <svg
      className="tour-note__brace"
      viewBox="0 0 26 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        pathLength="1"
        vectorEffect="non-scaling-stroke"
        d="M21 4C15.5 5.5 15 9 14.8 15C14.6 24 15.2 34 14.2 43C13.4 51 10.5 55.5 4.5 59.6C10.5 63.7 13.4 68.2 14.2 76.2C15.2 85.2 14.6 95.2 14.8 104.2C15 110.2 15.5 113.7 21 115.2"
      />
      <path
        className="tour-note__brace-b"
        pathLength="1"
        vectorEffect="non-scaling-stroke"
        d="M20.6 5.2C16 6.6 15.6 9.9 15.4 15.7C15.2 24.6 15.8 34.2 14.8 43.2C14 51.4 11.3 55.9 5.4 60.1C11.2 63.9 13.9 68.5 14.7 76.5C15.7 85.5 15.1 95.1 15.3 104.1C15.5 110 15.9 113.2 20.7 114.5"
      />
    </svg>
  );
}

/* â”€â”€ The toolbox - the one both acts use â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/** Every section expanded, always. A collapsed rail hides the very thing the
    descent exists to show, and a rail that unfolded as the camera passed would
    be moving the target it is travelling towards. */
function Toolbox({
  route,
  hover,
  drops,
}: {
  route?: RouteId;
  /** The target id under the cursor. Same key space as `data-tgt`, so the lit
      row and the pointed-at row are the same row by construction. */
  hover?: string;
  /** Act two: the rows taking a delivery, and the step of the stagger each
      one animates on. Absent in act one. Resolved by the director from what
      the frame actually shows, not from the delivery list, so a row cannot be
      ticked off the bottom of the picture. */
  drops?: Record<string, number>;
}) {
  const tool = route && route !== "portal" ? route.split("/")[0] : null;
  return (
    <aside className="px-toolbox">
      <span
        data-tgt="dashboard"
        className={
          "px-sidelink" +
          (route === "portal" ? " is-active" : "") +
          (hover === "dashboard" ? " is-hover" : "")
        }
      >
        <FiHome className="size-4 shrink-0" aria-hidden="true" />
        Dashboard
      </span>

      <span className="px-toolbox__heading">Toolbox</span>

      {TOOLS.map(({ id, label, Icon, subtabs }) => (
        <div key={id} className="px-tool px-tool--open">
          <div className="px-tool__head">
            <span
              data-tgt={id}
              className={
                "px-sidelink" +
                (tool === id ? " is-active" : "") +
                (hover === id ? " is-hover" : "")
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </span>
            <span className="px-tool__caret" aria-expanded="true">
              <FiChevronRight aria-hidden="true" />
            </span>
          </div>
          <div className="px-tool__body px-tool__body--open">
            <div className="px-tool__inner">
              {subtabs.map(({ path, label: sub }) => {
                const key = `${id}/${path}`;
                // The row a delivery lands on, if this is one. The tick is all
                // the row says: the packet flying into it carries the words,
                // and repeating them on a 163px subtab is how a clean rail
                // turns into a wall of green labels.
                const drop = drops?.[key];
                return (
                  <span
                    key={path}
                    data-tgt={key}
                    className={
                      "px-sidelink px-sidelink--sub" +
                      (route === key ? " is-active" : "") +
                      (hover === key ? " is-hover" : "") +
                      (drop !== undefined ? " tour2-land" : "")
                    }
                    style={
                      drop !== undefined
                        ? ({ "--i": drop } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {sub}
                    {drop !== undefined && (
                      <b className="tour2__tick" aria-hidden="true">
                        ✓
                      </b>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
}

/* â”€â”€ Act one: the portal, recreated â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function PortalMock({
  route,
  hover,
  drops,
  stickyTop,
  ms,
}: {
  route: RouteId;
  hover?: string;
  /** Act two: the rail's rows taking deliveries, and Office is the live tab.
      Its presence at all is what says "act two" to this half of the tree. */
  drops?: Record<string, number>;
  /** How far down the page the window's top edge currently sits. The bar rides
      that so it stays pinned, exactly as `position: sticky` does in the real
      portal - which cannot be used here, because there is no scrolling
      ancestor to be sticky against: the camera is a transform. */
  stickyTop: number;
  /** The shot's duration, so the bar travels with the camera rather than
      chasing it. */
  ms: number;
}) {
  const page = TOUR_PAGES[route];
  return (
    <div className="px-scope tour__portal">
      <header
        className="px-topbar tour__bar"
        style={{
          transform: `translateY(${stickyTop}px)`,
          transitionDuration: `${ms}ms`,
        }}
      >
        <div className="px-topbar__inner">
          <span className="px-brand">
            <img src="/portara-test/brand/portara-lockup-horizontal-black-plain.svg" alt="" />
          </span>
          {/* No co-branding chip: the slot is for a logo the tenant uploads,
              and this one has not, so the real bar shows nothing there. The
              orange square standing in for it was the only invented thing on
              the whole bar. */}
          <nav className="px-nav">
            <span className={"px-navlink" + (drops ? "" : " is-active")}>
              Portal
            </span>
            <span
              data-tgt="nav-office"
              className={
                "px-navlink" +
                (drops ? " is-active" : "") +
                (hover === "nav-office" ? " is-hover" : "")
              }
            >
              Office
            </span>
            <span className="px-navlink">Settings</span>
          </nav>
          <span className="px-switcher__btn">
            <span className="px-switcher__name">Industrial Contractor</span>
          </span>
          <div className="px-topbar__spacer" />
          <div className="px-topbar__right">
            <span className="tour__avatar">DM</span>
            <span className="tour__me">Dave M.</span>
          </div>
        </div>
      </header>

      <div className="px-portal">
        <Toolbox route={route} hover={hover} drops={drops} />

        {/* Keyed on the route so every navigation re-mounts the page and
            replays its entrance - which is what makes a click read as a click
            rather than as text being swapped underneath you. */}
        {/* Core's own page shell (px-shell / px-header / px-title), with the
            tenant's view inside it - the same nesting the live portal has, so
            the header above the table is the product's and the table is
            theirs. Keyed on the route so every navigation re-mounts and
            replays its entrance: that is what makes a click read as a click
            rather than as text being swapped underneath you. */}
        <main className="px-portal__main tour__main" key={route}>
          <div className="px-shell px-shell--fluid tour__page">
            <div className="px-header">
              <div>
                <span className="px-eyebrow">{page.eyebrow}</span>
                <h1 className="px-title">{page.title}</h1>
                <p className="px-sub">{page.sub}</p>
              </div>
              <span className="tour__asof">Snapshot - {AS_OF}</span>
            </div>
            <page.Body />
          </div>
        </main>
      </div>
    </div>
  );
}
