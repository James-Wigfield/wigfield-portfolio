/* Small shared helpers for the two-lecture shell (kept in a .js file so the
   .jsx files export components only). */

// "4–8" → "slides 4–8", "29" → "slide 29"
export const receipt = (slides) => `${/[–,]/.test(String(slides)) ? 'slides' : 'slide'} ${slides}`;

// One real notebook page: at most this many ruled lines, everything included,
// measured on the sheet laid out at REF_WIDTH px.
export const RULE_BUDGET = 30;
export const REF_WIDTH = 760;
