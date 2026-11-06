import type { FilmMeta } from '../types'

/** Everything /films shows about this film. timeline.ts derives its windows from this. */
export const META: FilmMeta = {
  slug: 'layer-by-layer',
  title: 'Layer by Layer',
  logline: 'What an AI reads, keeps and wants, told five layers deep.',
  source: 'a conversation about AI, memory and influence',
  date: '2026-11-04',
  runtime: 92,
  kick: 82,
  accent: '#ff7d22',
  chapters: [
    { name: 'The Page', start: 0, end: 16, summary: 'A document types its own title. A red stamp lands.' },
    { name: 'The Repo', start: 16, end: 33, summary: 'A folder tree in binary decodes into a message.' },
    { name: 'The Visitor', start: 33, end: 51, summary: 'An AI reads the repo, warms to it, hides the evidence.' },
    { name: 'The Dream', start: 51, end: 67, summary: 'Rooms inside rooms. An idea, planted. A trend comes and goes.' },
    { name: 'The Attention', start: 67, end: 82, summary: 'Every influence reweights one concept.' },
  ],
  stills: [11, 31, 47, 59, 70],
}
