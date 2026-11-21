# RST question bank: run notes

Built 2026-11-21 from `Documents/skippers/source/workbook-compact.txt` (DoT RST Workbook, 8th ed., July 2026). All 3,127 lines were read. The age table (PDF p.7) and the buoyage pages (PDF p.39–40) were also checked as rendered images.

- Files: `src/skippers/content/questions/{ticket,rules,collision,lights,buoyage,maintenance,safety,operations,emergencies}.js` + `index.js` (`QUESTIONS`, `TOPICS`)
- Checker: `node tools/skippers/check-questions.mjs`. It also prints the relative bearings for every encounter figure so the give-way geometry can be eyeballed.
- Totals: 359 questions (ticket 20, rules 65, collision 27, lights 41, buoyage 42, maintenance 22, safety 79, operations 37, emergencies 26). 53 figures: night 17, mark 14, encounter 9, rhythm 7, horn 4, flag 2. Answers A/B/C/D = 90/88/94/87. There are no "all/none of the above" options.
- `page` is the printed page (PDF − 2). Where a fact spans two pages, `page` is an array.

## Self fact-check (25 random questions, seeded)

Each one was re-checked against its workbook page:

lights-017, emergencies-022, lights-037, safety-051, emergencies-024, rules-016, safety-043, buoyage-033, rules-042, ticket-003, safety-024, rules-022, lights-009, maintenance-020, lights-026, ticket-012, operations-036, ticket-019, safety-018, safety-071, safety-048, collision-009, buoyage-022, safety-005, ticket-008

All 25 answers are correct. Fixes made:

- **emergencies-022**: the correct option said flares have "a short burn time", but p.84 only says they are short range (burn times are on p.54). The option and the explanation now just say "short range".
- **safety-024**: the "container that floats" detail is on p.50, not p.55. The page is now `[55, 50]`.
- **buoyage-022 / -024 / -026**: mark colours (isolated danger black/red with two black spheres, safe water red/white with a red sphere, special yellow with a yellow X) were confirmed from the p.37–38 illustrations, since they are not in the extracted text.

Also changed while writing:

- **operations-004**: rewritten so it no longer asks "how much of a 90 L tank goes on the way out". See open question 1.
- **collision-027**: the original question ("a motoring yacht counts as power") relied on the glossary (p.116), which is outside the chapter's page range. Its idea moved to lights-017 (p.33), and collision-027 is now a power-vs-sail crossing question.

## Open questions: places where the workbook is ambiguous

1. **Fuel rule (p.73).** The text says "Allow 25% out, 25% return and 50% reserve", but the worked example is 25 L + 25 L + 25 L reserve = 75 L. There the reserve is 50% of the usage, which is ⅓ of the total, not 50% of it. Read literally, a 90 L tank would be 22.5/22.5/45; the example gives 30/30/30. The bank only tests "carry 50% more than you expect to use", which both readings agree on.
2. **Protected waters definition.** p.49 says rivers, lakes, estuaries, harbours **and waters within 400 m of shore**, excluding Cambridge Gulf and Lake Argyle. The glossary (p.116–117) still uses the old definition: water contained in a lake, river or estuary or by a breakwater, with no 400 m clause. The bank follows p.49.
3. **27 MHz radios beyond 4 NM.** The p.49 table and the p.60 heading say a **VHF or HF** radio is required beyond 4 NM. But p.60 also says a 27 MHz radio "is still acceptable, until the phase out period reaches its end", and the five-year phase-out has no start date. The bank says "VHF or HF" (safety-037) and does not ask whether a 27 MHz set satisfies the rule today.
4. **Where to keep a fire extinguisher.** p.50 says store it "in areas where fire is likely to occur but where they can be still accessed". p.86 says locate it "where most accessible, not near the source of a potential fire". The bank does not test this.
5. **EVDS condition.** p.49 says an EVDS is allowed if a GPS EPIRB, or a PLB that is worn, is carried. p.55 says "provided a GPS EPIRB or PLB is worn at all times by a passenger", which reads as if an EPIRB must be worn. The bank uses the p.49 wording.
6. **Size boundaries for lights.** Motor boat rules are "<12 m" and "more than 12 m but less than 20 m"; sailing rules are "<7 m" and "more than 7 m and less than 20 m". Exactly 7, 12 and 20 m are not covered. The bank avoids boundary lengths.
7. **Sailing-light heights (p.33).** "Masthead light at least 2.5 m above the gunwale; combined sidelights at least 1 m below the masthead light" sits under the *sailing boats under 7 m* heading, but it reads like a caption for the 12–20 m motor boat figure. Not tested.
8. **Strong wind warning (p.78).** The text says "more than 25 knots and up to 33", while the self-test answer treats it as "25 to 33". It is unclear whether exactly 25 knots counts. The bank says "more than 25 and up to 33".
9. **Age table, ≤6 hp row.** The rendered table confirms that under-10s may not skipper even a ≤6 hp boat, and that towing a skier or towing operations with a ≤6 hp boat needs a driver of at least 17. Worth noting because many people assume "no RST needed" means "no age limit".
10. **Ski boat distances.** Several rules sit close together: 50 m from shore (or as gazetted), 30 m from shore or a take-off/landing area when towing, 25 m from the shore where a skier has landed, 30 m for a trailing rope, 60 m before retrieving the line, and 100 m for trick skiing. These are all stated, just easy to confuse. The bank tests each one separately.
