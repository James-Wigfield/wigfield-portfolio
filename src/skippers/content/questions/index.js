// RST theory question bank, written from the DoT RST Workbook, 8th edition (July 2026).
// `page` on every question is the PRINTED workbook page (PDF page − 2).
// Validate with: node tools/skippers/check-questions.mjs

import ticket from './ticket.js'
import rules from './rules.js'
import collision from './collision.js'
import lights from './lights.js'
import buoyage from './buoyage.js'
import maintenance from './maintenance.js'
import safety from './safety.js'
import operations from './operations.js'
import emergencies from './emergencies.js'

// examWeight = how many of the 40 exam questions a mock paper draws from the topic (sums to 40).
export const TOPICS = [
  { id: 'ticket', label: "The Recreational Skipper's Ticket", chapter: 1, pages: [5, 9], examWeight: 2 },
  { id: 'rules', label: 'Rules and Regulations', chapter: 2, pages: [11, 25], examWeight: 6 },
  { id: 'collision', label: 'Collision Avoidance', chapter: 3, pages: [27, 29], examWeight: 5 },
  { id: 'lights', label: 'Navigation Lights', chapter: 4, pages: [31, 35], examWeight: 5 },
  { id: 'buoyage', label: 'IALA Buoyage', chapter: 5, pages: [37, 41], examWeight: 5 },
  { id: 'maintenance', label: 'Maintenance', chapter: 6, pages: [43, 46], examWeight: 3 },
  { id: 'safety', label: 'Safety Equipment', chapter: 7, pages: [49, 71], examWeight: 7 },
  { id: 'operations', label: 'Safe Operations', chapter: 8, pages: [73, 81], examWeight: 4 },
  { id: 'emergencies', label: 'Emergencies', chapter: 9, pages: [83, 89], examWeight: 3 },
]

export const QUESTIONS = [
  ...ticket,
  ...rules,
  ...collision,
  ...lights,
  ...buoyage,
  ...maintenance,
  ...safety,
  ...operations,
  ...emergencies,
]

export default QUESTIONS
