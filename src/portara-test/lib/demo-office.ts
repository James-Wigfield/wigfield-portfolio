// GoFlo's office, baked as static data for the public landing page.
// Snapshot of the real layout (office_layouts for the GoFlo business), with
// a couple of portlets set to "working" so the showcase has life in it.
// The showcase is view-only and never touches the database, so this never
// goes stale in a way that matters - re-bake it whenever the real office
// gets a facelift worth showing off.

import type { OfficeLayout } from "../portal-ui/lib/office-layout";
import type { OfficeWorker } from "../portal-ui/components/office3d/builder";

/** Run times are relative so the two showcased cards never read as stale
    ("last ran 6 Aug" on a page that is always live would undersell it). */
const minsAgo = (mins: number) =>
  new Date(Date.now() - mins * 60000).toISOString();

export const DEMO_WORKERS: OfficeWorker[] = [
  { id: "6a593e35-88f5-4328-8d35-f8f40a9c4301", name: "Davo", status: "idle", sprite: "otto" },
  // The two below are the ones standing on the floor (see `agents`), so they
  // are the only two whose cards are read - hence the full set of card facts:
  // a job title, a track record either side of the Strong/Steady line, and
  // one of each autonomy mode.
  {
    id: "020202cf-f9a6-4a14-a66e-fb9f17446622",
    name: "James",
    title: "Marketing Assistant",
    status: "idle",
    sprite: "pip",
    autonomy: "suggest",
    confidence: 78,
    confidenceRuns: 34,
    lastRunAt: minsAgo(96),
  },
  { id: "11ed5dd3-beb4-44cb-ab1b-04b15d17efdb", name: "Justin", status: "idle", sprite: "pip" },
  { id: "d000bbfd-5ceb-4a77-827e-b66b335d91fa", name: "Steve", status: "idle", sprite: "otto" },
  {
    id: "b6d5d3c5-07b6-46d2-846a-833f5fe4ad30",
    name: "Justin",
    title: "Accounts Clerk",
    status: "working",
    sprite: "pip",
    task: "Chasing this week's unpaid quotes",
    autonomy: "act",
    confidence: 94,
    confidenceRuns: 212,
    lastRunAt: minsAgo(4),
  },
];

export const DEMO_LAYOUT: OfficeLayout = {
  v: 1,
  tiles: [
    [9, 7], [8, 7], [7, 7], [6, 7], [5, 7], [4, 7], [3, 7], [2, 7], [2, 6],
    [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [9, 5], [8, 5],
    [7, 5], [6, 5], [5, 5], [4, 5], [3, 5], [2, 5],
  ],
  walls: [
    { o: "h", x: 9, z: 5, door: false },
    { o: "h", x: 8, z: 5, door: false },
    { o: "h", x: 7, z: 5, door: false },
    { o: "h", x: 6, z: 5, door: false },
    { o: "h", x: 5, z: 5, door: false },
    { o: "h", x: 4, z: 5, door: false },
    { o: "h", x: 3, z: 5, door: false },
    { o: "h", x: 2, z: 5, door: false },
    { o: "h", x: 2, z: 8, door: false },
    { o: "h", x: 3, z: 8, door: false },
    { o: "h", x: 4, z: 8, door: false },
    { o: "h", x: 5, z: 8, door: false },
    { o: "h", x: 6, z: 8, door: false },
    { o: "h", x: 7, z: 8, door: false },
    { o: "h", x: 8, z: 8, door: false },
    { o: "h", x: 9, z: 8, door: false },
    { o: "v", x: 10, z: 7, door: false },
    { o: "v", x: 10, z: 6, door: false },
    { o: "v", x: 10, z: 5, door: false },
    { o: "v", x: 6, z: 7, door: true },
    { o: "v", x: 6, z: 6, door: false },
    { o: "v", x: 6, z: 5, door: false },
    { o: "v", x: 2, z: 7, door: false },
    { o: "v", x: 2, z: 6, door: false },
    { o: "v", x: 2, z: 5, door: false },
  ],
  items: [
    { x: 7, z: 6, id: "d34b0b4b-5560-4f51-b103-542eca6593df", rot: 0, type: "desk" },
    { x: 8, z: 6, id: "975b909b-63cc-445f-ae56-39afbf8b175b", rot: 0, type: "desk" },
    { x: 4, z: 6, id: "5d1b55d7-6e79-49ca-a403-db3369bcd665", rot: 1, type: "desk" },
    { x: 8, z: 5, id: "12c85f71-b06a-4951-9b09-610c5c065e04", rot: 0, type: "bookshelf" },
    { x: 2, z: 6, id: "3389bea2-aa2d-4995-9bee-3056d2addcda", rot: 3, type: "bookshelf" },
    { x: 2, z: 7, id: "9ae04c57-1894-4f23-ba71-1b8b2d82a905", rot: 3, type: "bookshelf" },
    { x: 2, z: 5, id: "6f9f868c-d611-4563-966c-f90d324a2720", rot: 0, type: "plant" },
    { x: 9, z: 5, id: "218726e5-1f0b-4aee-b87e-5c585aa44b12", rot: 0, type: "plant" },
    { x: 6, z: 6, id: "27dc51d1-74da-40a7-b280-45a28f731319", rot: 3, type: "whiteboard" },
    { x: 4, z: 7, id: "9c25de4c-4370-4ac0-8c0e-9ec2ee1bf7cd", rot: 2, type: "whiteboard" },
    { x: 3, z: 5, id: "d7072a73-eb2d-4a67-8ce5-d4bbabf05bd6", rot: 0, type: "beanbag" },
    { x: 5, z: 5, id: "5742b33f-7745-47c5-8ea9-6838df23191f", rot: 1, type: "coffee" },
    { x: 7, z: 5, id: "e2f53d5e-a7fc-4acc-b023-d70b1e14bab6", rot: 0, type: "bookshelf" },
    { x: 6, z: 5, id: "bae75c18-9433-451b-ba1c-3181f1fdf364", rot: 0, type: "lamp" },
    { x: 9, z: 6, id: "7dd30798-7fb9-486d-be4a-8031d6116979", rot: 0, type: "beanbag" },
  ],
  agents: [
    {
      workerId: "b6d5d3c5-07b6-46d2-846a-833f5fe4ad30",
      deskId: "975b909b-63cc-445f-ae56-39afbf8b175b",
      zone: [[8, 6]],
    },
    {
      workerId: "020202cf-f9a6-4a14-a66e-fb9f17446622",
      deskId: "5d1b55d7-6e79-49ca-a403-db3369bcd665",
      zone: [[4, 6], [3, 6], [3, 7], [4, 5], [5, 6], [5, 7]],
    },
  ],
  legend: [
    { id: "f870399b-13a6-4a24-a066-d32cd577a5b1", name: "Marketing", color: "#d77733" },
  ],
  tints: {},
};
