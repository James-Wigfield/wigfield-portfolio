/* ============================================================================
   TRICKY TOPICS — THE UNIT'S LECTURES (shared by every topic)
   ----------------------------------------------------------------------------
   One row per CITS5017 lecture deck: its label as the tabs and receipts
   write it, its slide count (tools/dl-tricky-topics/check-maths.mjs keeps
   every receipt inside its deck), and the portal module a "where it shows
   up" link opens. Exam Practice is the target of "what the exam asks"
   links (it has no per-part deep links: the label names the part).
   ========================================================================== */

export const LECTURES = {
  L1: { label: 'L1', title: 'Intro to ANNs', slides: 64, route: '/portal/dl-lectures-1-2-refresher', module: 'Lectures 1–2 refresher' },
  L2: { label: 'L2', title: 'Training DNNs', slides: 68, route: '/portal/dl-lectures-1-2-refresher', module: 'Lectures 1–2 refresher' },
  L3: { label: 'L3', title: 'CNNs', slides: 53, route: '/portal/dl-lecture-3-study', module: 'Lecture 3 study' },
  L4: { label: 'L4', title: 'Processing sequences', slides: 52, route: '/portal/dl-lecture-4-study', module: 'Lecture 4 study' },
  L5: { label: 'L5', title: 'Autoencoders', slides: 27, route: '/portal/dl-lecture-5-study', module: 'Lecture 5 study' },
  'L6–7': { label: 'L6–7', title: 'Conv/variational AEs and GANs', slides: 32, route: '/portal/dl-lecture-6-7-study', module: 'Lectures 6–7 study' },
  L8: { label: 'L8', title: 'Transformers', slides: 51, route: '/portal/dl-lecture-8-study', module: 'Lecture 8 study' },
  L9: { label: 'L9', title: 'Reinforcement learning', slides: 69, route: '/portal/dl-lecture-9-study', module: 'Lecture 9 study' },
};

export const LECTURE_ORDER = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6–7', 'L8', 'L9'];

export const EXAM_PRACTICE = '/portal/dl-exam-practice';

// "L3 · slides 20–21" → { lec: 'L3', slides: [20, 21] } (null if not a deck receipt)
export function parseReceipt(text) {
  const m = /^(L\d(?:–\d)?) · slides? ([\d–, ]+)/.exec(String(text).trim());
  if (!m) return null;
  const slides = [];
  m[2].split(',').forEach((part) => {
    const [a, b] = part.trim().split('–').map(Number);
    if (Number.isFinite(a)) for (let n = a; n <= (Number.isFinite(b) ? b : a); n++) slides.push(n);
  });
  return { lec: m[1], slides };
}
