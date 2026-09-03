// The pages the workspace tour opens - the demo tenant's own screens, frozen.
//
// WHAT THIS IS. A snapshot of demo-industrial-contractor.portara.com.au/portal
// taken on 2026-08-09: the same views, built from the same markup and the same
// `dm-` classes their overlay ships (tenants/demo-industrial-contractor/*.tsx
// and demo.css), carrying the actual rows out of their tables. Not "a table
// that looks like theirs" - their table, with their data in it.
//
// WHY IT IS HARD-CODED. The landing page is a different Worker in a different
// account; it cannot import a tenant's overlay and must never query a tenant's
// records. So the derived numbers - hours booked off dockets, exposure off
// overruns, drawdown per purchase order, tickets held per person - were
// computed once from the live tables and written down here as literals, with
// the working shown beside each so the next person can re-derive them rather
// than wonder. Re-take the snapshot the same way when the demo data moves.
//
// AS OF is stated on every page that shows a relative date, because "in 4
// days" is a lie the moment the snapshot ages, and a shot of a product should
// not quietly claim to be live.
import type { ReactNode } from "react";

/* ── The tenant's own primitives, as their overlay defines them ──────────── */

type Tone = "slate" | "amber" | "sky" | "violet" | "emerald" | "rose";

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={`dm-badge dm-badge--${tone}`}>{label}</span>;
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="dm-section">
      <h2 className="dm-section__title">
        {title}
        {meta && <span className="dm-section__meta">{meta}</span>}
      </h2>
    </div>
  );
}

function Note({
  tone = "plain",
  title,
  children,
}: {
  tone?: "plain" | "ok" | "warn" | "alert";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`dm-note${tone === "plain" ? "" : ` dm-note--${tone}`}`}>
      <div className="dm-note__body">
        <p className="dm-note__title">{title}</p>
        {children && <p className="dm-note__sub">{children}</p>}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="dm-metric">
      <span className="dm-metric__label">{label}</span>
      <span className="dm-metric__value">{value}</span>
      {sub && <span className="dm-metric__sub">{sub}</span>}
    </div>
  );
}

function Bar({ value, of }: { value: number; of: number }) {
  const ratio = of > 0 ? value / of : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const mod =
    ratio > 1 ? " dm-bar__fill--over" : ratio > 0.85 ? " dm-bar__fill--warn" : "";
  return (
    <div className="dm-bar">
      <div className={`dm-bar__fill${mod}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Col = string | { label: string; num?: boolean };

function Table({ cols, children }: { cols: Col[]; children: ReactNode }) {
  return (
    <div className="dm-card">
      <div className="dm-tablewrap">
        <table className="dm-table">
          <thead>
            <tr>
              {cols.map((c, i) => {
                const col = typeof c === "string" ? { label: c, num: false } : c;
                return (
                  <th key={i} className={col.num ? "dm-num" : undefined}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

/** Two lines in one cell - the tenant's standard primary/sub pair. */
function Cell({ main, sub }: { main: string; sub?: string }) {
  return (
    <td>
      <span className="dm-table__primary">{main}</span>
      {sub && <span className="dm-cellsub">{sub}</span>}
    </td>
  );
}

/* ── The snapshot ────────────────────────────────────────────────────────── */

/** The day the numbers below were true. Everything relative is stated against
    this rather than against the visitor's clock. */
const AS_OF = "9 Aug 2026";

/* ── Dashboard (/portal) ─────────────────────────────────────────────────── */

export function DashboardPage() {
  return (
    <div className="dm">
      <Note tone="alert" title="Two people cannot go to the work they are on">
        Dave Kowalski&rsquo;s HV switching authority lapses the day he mobilises
        to Solomon Hub, and Lena Fitzgerald is carrying an expired electrical
        licence into Tom Price. Renew the ticket or reassign before the crew
        mobilise.
      </Note>

      <div className="dm-metrics">
        <Metric label="On the ground" value="4" sub="1 on hold" />
        <Metric label="Lapsed tickets" value="3" sub="need renewing" />
        <Metric
          label="Live pipeline"
          value="$5,400,000"
          sub="4 closing inside 14 days"
        />
        <Metric
          label="Unclaimed exposure"
          value="$24,372"
          sub="4 work orders over scope"
        />
      </div>

      <div className="dm-cols2">
        <section className="dm-card">
          <div className="dm-card__head">
            <h2 className="dm-card__title">Site readiness</h2>
            <span className="dm-btn">Expiry board</span>
          </div>
          <div className="dm-feed">
            <div className="dm-feed__row">
              <Badge label="Blocked" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">
                  Dave Kowalski - Switchroom SR-04 shutdown
                </div>
                <div className="dm-feed__meta">
                  Solomon Hub, starts 16 Aug - missing HV switching authority
                </div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="Blocked" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">
                  Lena Fitzgerald - MCC-7 protection relay upgrade
                </div>
                <div className="dm-feed__meta">
                  Tom Price Processing, starts 7 Aug - missing electrical
                  licence, site induction
                </div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="Expiring" tone="amber" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">Coby Trent - high risk work licence</div>
                <div className="dm-feed__meta">Lapses 25 Aug - on Karara from 22 Aug</div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="Expiring" tone="amber" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">Sam Whitcombe - first aid</div>
                <div className="dm-feed__meta">Lapses 29 Aug - supervising Cape Lambert</div>
              </div>
            </div>
          </div>
        </section>

        <section className="dm-card">
          <div className="dm-card__head">
            <h2 className="dm-card__title">Money left on the table</h2>
            <span className="dm-btn">Cost</span>
          </div>
          <div className="dm-feed">
            <div className="dm-feed__row">
              <Badge label="No PO" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">WO-2404 - Shiploader lighting tower replacement</div>
                <div className="dm-feed__meta">
                  Hedland Port Authority - $13,920 booked against no purchase order
                </div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="Unvaried" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">WO-2402 - Wharf conveyor CV-12 relocation</div>
                <div className="dm-feed__meta">
                  44 h beyond quote - $6,392, two variations still unapproved
                </div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="No PO" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">WO-2412 - Digester 3 cable pull</div>
                <div className="dm-feed__meta">
                  Kwinana Alumina Refinery - $3,190 booked on a verbal
                </div>
              </div>
            </div>
            <div className="dm-feed__row">
              <Badge label="Rejected" tone="rose" />
              <div className="dm-feed__body">
                <div className="dm-feed__title">WO-2413 - SR-02 breaker replacement</div>
                <div className="dm-feed__meta">
                  VAR-104 rejected - $870 of strip and clean unrecovered
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Work orders / Schedule ──────────────────────────────────────────────── */

/** The fortnight from AS_OF, as the schedule matrix draws it. */
const DAYS = [
  { d: 9, w: "S" }, { d: 10, w: "M" }, { d: 11, w: "T" }, { d: 12, w: "W" },
  { d: 13, w: "T" }, { d: 14, w: "F" }, { d: 15, w: "S" }, { d: 16, w: "S" },
  { d: 17, w: "M" }, { d: 18, w: "T" }, { d: 19, w: "W" }, { d: 20, w: "T" },
  { d: 21, w: "F" }, { d: 22, w: "S" },
];

/** Site rows, and which day columns carry a dot. The matrix shows the FIRST
    work order matching each day, which is why Cape Lambert turns from its
    on-site conveyor job to the held loop checks halfway through. */
const SCHEDULE: {
  site: string;
  client: string;
  cells: { from: number; to: number; tone: "emerald" | "amber" | "rose" }[];
}[] = [
  {
    site: "Cape Lambert Wharf",
    client: "Pilbara Iron Operations",
    // WO-2402 on site to the 12th, then WO-2408 held from the 13th.
    cells: [
      { from: 9, to: 12, tone: "emerald" },
      { from: 13, to: 15, tone: "rose" },
    ],
  },
  {
    site: "East Rockingham Workshop",
    client: "Monadelphous Engineering",
    cells: [{ from: 9, to: 14, tone: "emerald" }],
  },
  {
    site: "Karara Mine Site",
    client: "Karara Midwest",
    cells: [{ from: 22, to: 22, tone: "amber" }],
  },
  {
    site: "Port Hedland Berth 4",
    client: "Hedland Port Authority",
    cells: [
      { from: 9, to: 9, tone: "emerald" },
      { from: 13, to: 15, tone: "amber" },
    ],
  },
  {
    site: "Solomon Hub",
    client: "Solomon Resources",
    cells: [{ from: 16, to: 21, tone: "amber" }],
  },
  {
    site: "Tom Price Processing",
    client: "Pilbara Iron Operations",
    cells: [{ from: 9, to: 11, tone: "amber" }],
  },
];

export function SchedulePage() {
  return (
    <div className="dm">
      <SectionHead title="Schedule" meta={`next 14 days - 8 work orders`} />
      <div className="dm-card">
        <div className="dm-tablewrap">
          <table className="dm-table dm-matrix">
            <thead>
              <tr>
                <th style={{ minWidth: "10rem" }}>Site</th>
                {DAYS.map((d) => (
                  <th key={d.d} className="dm-num" style={{ minWidth: "2.4rem" }}>
                    {d.d}
                    <span className="dm-cellsub">{d.w}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULE.map((row) => (
                <tr key={row.site}>
                  <Cell main={row.site} sub={row.client} />
                  {DAYS.map((d) => {
                    const hit = row.cells.find(
                      (c) => d.d >= c.from && d.d <= c.to,
                    );
                    return (
                      <td key={d.d} className={hit ? "dm-matrix__cell" : undefined}>
                        {hit && <span className={`dm-dot dm-dot--${hit.tone}`} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dm-matrix__legend">
          <span>
            <span className="dm-dot dm-dot--emerald" /> On site
          </span>
          <span>
            <span className="dm-dot dm-dot--amber" /> Planned or mobilising
          </span>
          <span>
            <span className="dm-dot dm-dot--rose" /> On hold
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Work orders / Cost ──────────────────────────────────────────────────── */

/**
 * Hours booked come from the dockets table; exposure from findOverruns, which
 * charges unrecovered hours at the job's own average docket rate and the WHOLE
 * booked value of a job with no purchase order behind it at all. Worked once
 * against the live rows, in the sort the page uses (burn, descending).
 */
const COST: {
  wo: string;
  title: string;
  client: string;
  quoted: number;
  booked: number;
  exposure: string | null;
  cover: { label: string; tone: Tone };
}[] = [
  {
    wo: "WO-2402",
    title: "Wharf conveyor CV-12 relocation and re-termination",
    client: "Pilbara Iron Operations",
    quoted: 180,
    booked: 224,
    // 44 h over, nothing approved: 44 x $145.27 average docket rate.
    exposure: "$6,392",
    cover: { label: "2 pending", tone: "amber" },
  },
  {
    wo: "WO-2413",
    title: "Switchroom SR-02 breaker replacement",
    client: "Karara Midwest",
    quoted: 32,
    booked: 38,
    // 6 h over and VAR-104 was rejected, so none of it is covered.
    exposure: "$870",
    cover: { label: "Unvaried", tone: "rose" },
  },
  {
    wo: "WO-2407",
    title: "Switchboard fabrication - SR-04 spare cubicles",
    client: "Monadelphous Engineering",
    quoted: 240,
    booked: 272,
    // 32 h over, and VAR-101 approved 34 h - covered, so no exposure.
    exposure: null,
    cover: { label: "Covered", tone: "emerald" },
  },
  {
    wo: "WO-2409",
    title: "Breakdown - berth 4 crane supply fault",
    client: "Hedland Port Authority",
    quoted: 26,
    booked: 26,
    exposure: null,
    cover: { label: "Within quote", tone: "emerald" },
  },
  {
    wo: "WO-2410",
    title: "Transformer TX-2 oil sampling",
    client: "Pilbara Iron Operations",
    quoted: 12,
    booked: 12,
    exposure: null,
    cover: { label: "Within quote", tone: "emerald" },
  },
  {
    wo: "WO-2404",
    title: "Shiploader lighting tower replacement",
    client: "Hedland Port Authority",
    quoted: 120,
    booked: 96,
    // Inside quote, but there is no PO, so the whole $13,920 is exposed.
    exposure: "$13,920",
    cover: { label: "No PO", tone: "rose" },
  },
  {
    wo: "WO-2412",
    title: "Digester 3 cable pull and terminations",
    client: "Kwinana Alumina Refinery",
    quoted: 64,
    booked: 22,
    exposure: "$3,190",
    cover: { label: "No PO", tone: "rose" },
  },
];

export function CostPage() {
  return (
    <div className="dm">
      <SectionHead title="Cost" meta="7 work orders with hours booked" />
      <Note tone="alert" title="$24,372 of work beyond quoted scope">
        4 work orders are over their quoted hours with no approved variation,
        and 2 have no purchase order at all.
      </Note>
      <Table
        cols={[
          "Work order",
          "Client",
          { label: "Quoted", num: true },
          { label: "Booked", num: true },
          "Burn",
          { label: "Exposure", num: true },
          "Cover",
        ]}
      >
        {COST.map((r) => (
          <tr key={r.wo}>
            <Cell main={r.wo} sub={r.title} />
            <td className="dm-table__muted">{r.client}</td>
            <td className="dm-num">{r.quoted}h</td>
            <td className="dm-num dm-table__primary">{r.booked}h</td>
            <td style={{ minWidth: "7rem" }}>
              <Bar value={r.booked} of={r.quoted} />
            </td>
            <td className="dm-num">
              {r.exposure ? (
                <span className="dm-table__primary">{r.exposure}</span>
              ) : (
                <span className="dm-table__muted">-</span>
              )}
            </td>
            <td>
              <Badge label={r.cover.label} tone={r.cover.tone} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ── Crew / Register ─────────────────────────────────────────────────────── */

/** Tickets held is DISTINCT ticket types on the certifications table; open
    work is work orders not complete or claimed that name the person. */
const CREW: {
  name: string;
  no: string;
  role: { label: string; tone: Tone };
  base: string;
  phone: string;
  email: string;
  tickets: number;
  open: number;
  standing: { label: string; tone: Tone };
}[] = [
  { name: "Coby Trent", no: "CE-130", role: { label: "Apprentice", tone: "slate" }, base: "East Rockingham", phone: "0451 772 006", email: "coby.trent@example.com", tickets: 8, open: 3, standing: { label: "1 expiring", tone: "amber" } },
  { name: "Dave Kowalski", no: "CE-104", role: { label: "HV technician", tone: "amber" }, base: "FIFO", phone: "0419 338 902", email: "dave.kowalski@example.com", tickets: 6, open: 1, standing: { label: "1 lapsed", tone: "rose" } },
  { name: "Hamish Boyd", no: "CE-119", role: { label: "Electrician", tone: "sky" }, base: "East Rockingham", phone: "0405 271 336", email: "hamish.boyd@example.com", tickets: 7, open: 3, standing: { label: "Current", tone: "emerald" } },
  { name: "Jack Doherty", no: "CE-107", role: { label: "Electrician", tone: "sky" }, base: "Port Hedland", phone: "0438 116 774", email: "jack.doherty@example.com", tickets: 8, open: 3, standing: { label: "Current", tone: "emerald" } },
  { name: "Lena Fitzgerald", no: "CE-115", role: { label: "Electrician", tone: "sky" }, base: "FIFO", phone: "0422 640 883", email: "lena.fitzgerald@example.com", tickets: 6, open: 1, standing: { label: "2 lapsed", tone: "rose" } },
  { name: "Marcus Bello", no: "CE-101", role: { label: "Supervisor", tone: "violet" }, base: "East Rockingham", phone: "0417 442 118", email: "marcus.bello@example.com", tickets: 8, open: 3, standing: { label: "Current", tone: "emerald" } },
  { name: "Nathan Kirby", no: "CE-121", role: { label: "HV technician", tone: "amber" }, base: "East Rockingham", phone: "0431 508 917", email: "nathan.kirby@example.com", tickets: 7, open: 4, standing: { label: "Current", tone: "emerald" } },
  { name: "Owen Marsh", no: "CE-109", role: { label: "Fabricator", tone: "slate" }, base: "East Rockingham", phone: "0410 887 265", email: "owen.marsh@example.com", tickets: 2, open: 1, standing: { label: "Current", tone: "emerald" } },
  { name: "Priya Raman", no: "CE-118", role: { label: "Instrument tech", tone: "emerald" }, base: "East Rockingham", phone: "0413 995 208", email: "priya.raman@example.com", tickets: 7, open: 1, standing: { label: "Current", tone: "emerald" } },
  { name: "Riley Nguyen", no: "CE-124", role: { label: "Instrument tech", tone: "emerald" }, base: "FIFO", phone: "0426 183 490", email: "riley.nguyen@example.com", tickets: 7, open: 1, standing: { label: "Current", tone: "emerald" } },
  { name: "Sam Whitcombe", no: "CE-103", role: { label: "Supervisor", tone: "violet" }, base: "Port Hedland", phone: "0428 771 040", email: "sam.whitcombe@example.com", tickets: 9, open: 2, standing: { label: "1 expiring", tone: "amber" } },
  { name: "Trent Fisher", no: "CE-112", role: { label: "Electrician", tone: "sky" }, base: "FIFO", phone: "0447 209 551", email: "trent.fisher@example.com", tickets: 6, open: 1, standing: { label: "Current", tone: "emerald" } },
];

const CREW_FILTERS = [
  { label: "All", n: 12, on: true },
  { label: "Supervisor", n: 2 },
  { label: "Electrician", n: 4 },
  { label: "HV technician", n: 2 },
  { label: "Instrument tech", n: 2 },
  { label: "Fabricator", n: 1 },
  { label: "Apprentice", n: 1 },
];

export function CrewPage() {
  return (
    <div className="dm">
      <SectionHead title="Crew" meta="12 on the books" />

      <div className="dm-metrics">
        <Metric label="Crew size" value="12" sub="on the books" />
        <Metric
          label="Lapsed tickets"
          value="2"
          sub="people with at least one expired ticket"
        />
        <Metric label="Committed" value="10" sub="people on an open work order" />
      </div>

      <div className="dm-tabs">
        {CREW_FILTERS.map((f) => (
          <span key={f.label} className={"dm-tab" + (f.on ? " is-active" : "")}>
            {f.label}
            <span className="dm-tab__count">{f.n}</span>
          </span>
        ))}
      </div>

      <Table
        cols={[
          "Name",
          "Role",
          "Base",
          "Contact",
          { label: "Tickets", num: true },
          { label: "Open work", num: true },
          "Standing",
        ]}
      >
        {CREW.map((c) => (
          <tr key={c.no}>
            <Cell main={c.name} sub={c.no} />
            <td>
              <Badge label={c.role.label} tone={c.role.tone} />
            </td>
            <td className="dm-table__muted">{c.base}</td>
            <td className="dm-table__muted">
              {c.phone}
              <span className="dm-cellsub">{c.email}</span>
            </td>
            <td className="dm-num">{c.tickets}</td>
            <td className="dm-num">{c.open}</td>
            <td>
              <Badge label={c.standing.label} tone={c.standing.tone} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ── Bid desk / Closing soon ─────────────────────────────────────────────── */

const CLOSING: {
  ref: string;
  title: string;
  client: string;
  site: string;
  discipline: string;
  closes: string;
  rel: string;
  value: string;
  stage: { label: string; tone: Tone };
}[] = [
  { ref: "RFQ-2026-112", title: "Modular switchroom fabrication - four units", client: "Monadelphous Engineering", site: "East Rockingham Workshop", discipline: "Fabrication", closes: "2 Aug 2026", rel: "7 days ago", value: "$1,200,000", stage: { label: "Past close", tone: "rose" } },
  { ref: "RFQ-2026-121", title: "33kV switchyard protection relay replacement", client: "Solomon Resources", site: "Solomon Hub", discipline: "HV", closes: "7 Aug 2026", rel: "2 days ago", value: "$920,000", stage: { label: "Past close", tone: "rose" } },
  { ref: "RFQ-2026-118", title: "Car dumper CD-2 electrical upgrade", client: "Pilbara Iron Operations", site: "Cape Lambert Wharf", discipline: "LV", closes: "10 Aug 2026", rel: "tomorrow", value: "$1,850,000", stage: { label: "Estimating", tone: "amber" } },
  { ref: "RFQ-2026-130", title: "Digester 3 shutdown electrical support, 2026 campaign", client: "Kwinana Alumina Refinery", site: "Kwinana Refinery", discipline: "Maintenance", closes: "13 Aug 2026", rel: "in 4 days", value: "$480,000", stage: { label: "Estimating", tone: "violet" } },
  { ref: "RFQ-2026-124", title: "Berth 3 and 4 shiploader instrumentation overhaul", client: "Hedland Port Authority", site: "Port Hedland Berth 4", discipline: "Instrumentation", closes: "16 Aug 2026", rel: "in 7 days", value: "$640,000", stage: { label: "Qualifying", tone: "sky" } },
  { ref: "RFQ-2026-127", title: "Village and workshop LV reticulation", client: "Karara Midwest", site: "Karara Mine Site", discipline: "LV", closes: "23 Aug 2026", rel: "in 14 days", value: "$310,000", stage: { label: "New", tone: "slate" } },
];

export function ClosingPage() {
  return (
    <div className="dm">
      <Table
        cols={[
          "Bid",
          "Client and site",
          "Discipline",
          "Closes",
          { label: "Value", num: true },
          "Stage",
        ]}
      >
        {CLOSING.map((b) => (
          <tr key={b.ref}>
            <Cell main={b.title} sub={b.ref} />
            <Cell main={b.client} sub={b.site} />
            <td className="dm-table__muted">{b.discipline}</td>
            <Cell main={b.closes} sub={b.rel} />
            <td className="dm-num dm-table__primary">{b.value}</td>
            <td>
              <Badge label={b.stage.label} tone={b.stage.tone} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ── Contracts / Purchase orders ─────────────────────────────────────────── */

/** Drawn is the sum of docket value on every work order naming that PO. */
const ORDERS: {
  number: string;
  description: string;
  client: string;
  value: string;
  valueC: number;
  drawn: string;
  drawnC: number;
  expires: string;
  rel: string;
}[] = [
  { number: "PO-HPA-9903", description: "Berth 4 electrical maintenance and minor works", client: "Hedland Port Authority", value: "$120,000", valueC: 12000000, drawn: "$4,713", drawnC: 471250, expires: "29 Aug", rel: "in 20 days" },
  { number: "PO-MON-1188", description: "Switchboard fabrication - Solomon SR-04 package", client: "Monadelphous Engineering", value: "$95,000", valueC: 9500000, drawn: "$35,904", drawnC: 3590400, expires: "2 Nov", rel: "in 85 days" },
  { number: "PO-KAR-4471", description: "Karara site electrical compliance testing", client: "Karara Midwest", value: "$85,000", valueC: 8500000, drawn: "$5,510", drawnC: 551000, expires: "1 Jan", rel: "in 145 days" },
  { number: "PO-SOL-88412", description: "Solomon Hub electrical maintenance and shutdown works, 2026 campaign", client: "Solomon Resources", value: "$450,000", valueC: 45000000, drawn: "$0", drawnC: 0, expires: "31 Jan", rel: "in 175 days" },
  { number: "PO-PIO-70233", description: "Panel agreement - electrical services, Pilbara operations", client: "Pilbara Iron Operations", value: "$780,000", valueC: 78000000, drawn: "$34,280", drawnC: 3428000, expires: "1 Apr", rel: "in 235 days" },
  { number: "PO-KWA-2210", description: "HV maintenance and shutdown support", client: "Kwinana Alumina Refinery", value: "$260,000", valueC: 26000000, drawn: "$0", drawnC: 0, expires: "31 May", rel: "in 295 days" },
];

export function OrdersPage() {
  return (
    <div className="dm">
      <SectionHead title="Purchase orders" meta="6 on file" />

      <Note tone="alert" title="2 open work orders with no purchase order">
        WO-2404 (Hedland Port Authority), WO-2412 (Kwinana Alumina Refinery).
        Labour booked to these cannot be claimed until a PO covers them.
      </Note>

      <div className="dm-metrics">
        <Metric label="Open orders" value="6" sub="available to draw against" />
        <Metric label="Expiring" value="1" sub="inside 30 days" />
        <Metric label="Nearly exhausted" value="0" sub="over 85 percent drawn" />
      </div>

      <Table
        cols={[
          "Order",
          "Client",
          { label: "Value", num: true },
          { label: "Drawn", num: true },
          "Drawdown",
          "Expires",
          "Status",
        ]}
      >
        {ORDERS.map((p) => (
          <tr key={p.number}>
            <Cell main={p.number} sub={p.description} />
            <td className="dm-table__muted">{p.client}</td>
            <td className="dm-num">{p.value}</td>
            <td className="dm-num dm-table__primary">{p.drawn}</td>
            <td style={{ minWidth: "7rem" }}>
              <Bar value={p.drawnC} of={p.valueC} />
            </td>
            <td className="dm-table__muted">
              {p.expires}
              <span className="dm-cellsub">{p.rel}</span>
            </td>
            <td>
              <Badge label="Open" tone="emerald" />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/* ── The map the tour reads ──────────────────────────────────────────────── */

/**
 * The page header is CORE's, not the tenant's: routes/portal.$toolId.tsx puts
 * "Tools" over the tool's own label and description, and the dashboard puts
 * "Dashboard" over the greeting. So the eyebrow and title below are the tool
 * definitions from tenants/demo-industrial-contractor/index.ts verbatim, and
 * the subtab a shot opened shows up in the body, exactly as it does live.
 */
export const TOUR_PAGES = {
  portal: {
    eyebrow: "Dashboard",
    title: "Good morning, Dave",
    sub: "This is the Industrial Contractor portal - your team, your workers and your tools in one place.",
    Body: DashboardPage,
  },
  "works/schedule": {
    eyebrow: "Tools",
    title: "Work orders",
    sub: "Every job on the ground - the board, the fortnight ahead, and quoted against actual.",
    Body: SchedulePage,
  },
  "works/cost": {
    eyebrow: "Tools",
    title: "Work orders",
    sub: "Every job on the ground - the board, the fortnight ahead, and quoted against actual.",
    Body: CostPage,
  },
  "crew/index": {
    eyebrow: "Tools",
    title: "Crew",
    sub: "The people and the tickets they hold, with live workload off the work orders.",
    Body: CrewPage,
  },
  "biddesk/closing": {
    eyebrow: "Tools",
    title: "Bid desk",
    sub: "RFQs in flight - the pipeline, what closes this fortnight, and the hit rate.",
    Body: ClosingPage,
  },
  "contracts/orders": {
    eyebrow: "Tools",
    title: "Contracts",
    sub: "Clients, their purchase orders and the variations that recover scope changes.",
    Body: OrdersPage,
  },
} as const;

export type TourRoute = keyof typeof TOUR_PAGES;

export { AS_OF };
