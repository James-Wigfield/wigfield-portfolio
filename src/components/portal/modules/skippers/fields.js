/* ============================================================================
   SKIPPERS · FORMS - the field map (pure data, no JSX: node checks import it)
   ----------------------------------------------------------------------------
   Every box is [x, top, w, h] in PDF points on an A4 page (595.276 x 841.89),
   measured top-down. The page renders them as % of the page, so they scale.

   Where the numbers come from: both PDFs are fillable (AcroForm). Each text
   field, tick box and date cell below is that widget's own /Rect, read with
   pypdf (tools/skippers/measure-widgets.py) and flipped to top-down. Three
   boxes are not widgets and were measured on the 200 dpi render instead
   (tools/skippers/render-forms.mjs --keep-png): the first "DD" cell of the
   doctor's date on eyesight p.1 (the PDF has no widget for it), and the two
   drawn tick boxes on the consent letter (their widgets are 10 x 16 pt, the
   printed squares are larger). Section tops are the heading baselines from
   the PDF text layer, minus the cap height.

   Field kinds
     text   one line of writing.        box, get(ctx) -> string | ''
     cells  one character per box.      cells: [box...], get(ctx) -> string
     tick   a tick in a box.            box, on: true
   ink: 'blue' = James's own details · 'red' = example only (someone else
   fills it). ctx = { me, device } (see SkippersForms.jsx: JAMES + the
   device-only details from localStorage).

   PRIVACY: James's date of birth and street address never live in this file
   or anywhere in source. They come from ctx.device (this browser only).
   ========================================================================== */

export const PAGE_PT = { w: 595.276, h: 841.89 };

// The public, already-published details (the phone number is on the Resume tab).
export const JAMES = {
  surname: 'Wigfield',
  given: 'James',
  suburb: 'Rockingham',
  state: 'WA',
  postcode: '6168',
  phone: '0455 887 910',
  email: 'james.wigfield123@gmail.com',
};

// Example people: obviously fictional. 5550 xxxx is the ACMA range set aside
// for fiction, so the phone numbers ring nobody.
export const EXAMPLE = {
  doctor: { name: 'Dr B. Example', practice: 'Example Medical Centre', address: '40 Sample Street, Exampleville WA 6000', phone: '(08) 5550 0123' },
  optom: { name: 'Dr A. Example', practice: 'Example Optometry', address: '40 Sample Street, Exampleville WA 6000', phone: '(08) 5550 0145' },
  parent: 'Jordan Example',
  // A week before the assessment day (Mon 23 Nov 2026): the eyesight test and
  // the consent letter both have to be done BEFORE the assessment.
  date: '16112026',
};

// ── helpers that read the device-only details ────────────────────────────────
const dobDigits = ({ device }) => (device?.dob ? device.dob.replace(/\D/g, '') : '');
const streetLine = ({ device }) => {
  if (!device?.number || !device?.street) return '';
  return `${device.unit ? `${device.unit}/` : ''}${device.number} ${device.street}`;
};
const streetNo = ({ device }) => (device?.number ? `${device.unit ? `${device.unit}/` : ''}${device.number}` : '');

// 17 x 17 pt date cells: two for the day, two for the month, four for the year.
const DOB_P1 = [106.4, 123.4, 148.0, 165.0, 189.6, 206.6, 223.6, 240.6].map((x) => [x, 155.7, 17, 17]);
const DOB_P2 = [106.4, 123.4, 148.0, 165.0, 189.6, 206.6, 223.6, 240.6].map((x) => [x, 156.5, 17, 17]);
const DOCTOR_DATE = [400.5, 417.5, 442.0, 459.1, 483.6, 500.6, 517.7, 534.7].map((x) => [x, 739.3, 17, 17]);
const OPTOM_DATE = [384.4, 401.4, 426.0, 443.0, 467.6, 484.6, 501.6, 518.7].map((x) => [x, 598.8, 17, 17]);

// Applicant's details block, the same on both eyesight pages (p.2 sits 0.2 to
// 0.8 pt lower and a hair narrower on the right).
function applicantFields(p, boxes) {
  return [
    { id: `${p}-surname`, kind: 'text', ink: 'blue', box: boxes.surname, get: ({ me }) => me.surname },
    { id: `${p}-given`, kind: 'text', ink: 'blue', box: boxes.given, get: ({ me }) => me.given },
    { id: `${p}-dob`, kind: 'cells', ink: 'blue', cells: boxes.dob, get: dobDigits, placeholder: 'DDMMYYYY', device: true },
    { id: `${p}-email`, kind: 'text', ink: 'blue', box: boxes.email, get: ({ me }) => me.email },
    { id: `${p}-address`, kind: 'text', ink: 'blue', box: boxes.address, get: streetLine, placeholder: 'Street no. & name', device: true },
    { id: `${p}-suburb`, kind: 'text', ink: 'blue', box: boxes.suburb, get: ({ me }) => me.suburb },
    { id: `${p}-state`, kind: 'text', ink: 'blue', box: boxes.state, get: ({ me }) => me.state },
    { id: `${p}-postcode`, kind: 'text', ink: 'blue', box: boxes.postcode, get: ({ me }) => me.postcode },
    { id: `${p}-phone`, kind: 'text', ink: 'blue', box: boxes.phone, get: ({ me }) => me.phone },
  ];
}

/* Status of a section, shown as a small labelled dot beside its note.
   tone: 'blue' (the applicant writes it), 'red' (someone else writes it),
   'open' (only sometimes), 'grey' (read only / not needed). */
export const STATUS = {
  applicant: { tone: 'blue', label: 'Applicant fills this' },
  ifCondition: { tone: 'open', label: 'Only if a condition applies' },
  doctor: { tone: 'red', label: 'Doctor fills this' },
  optometrist: { tone: 'red', label: 'Optometrist fills this' },
  parent: { tone: 'red', label: 'Parent fills this' },
  readOnly: { tone: 'grey', label: 'Read only' },
  notForJames: { tone: 'grey', label: 'Not needed for James' },
};

export const FORMS = [
  {
    id: 'eyesight',
    tab: 'Eyesight & medical',
    title: 'Eyesight Declaration (non-MDL holders)',
    ref: '09-11-14-RST-0626-WEB',
    pdfName: 'RST eyesight and medical declaration (filled)',
    status: "Not required for James: licence holder. Filled as a worked example.",
    who: "Only for applicants WITHOUT a current Australian driver's licence. An optometrist, doctor or registered nurse does page 2 BEFORE the assessment day (Mon 23 Nov 2026).",
    pages: [
      {
        n: 1,
        img: '/skippers-forms/eyesight-1.webp',
        caption: 'Page 1 · Declaration of Medical Fitness',
        sections: [
          {
            n: '01',
            top: 124,
            title: "Applicant's details",
            status: 'applicant',
            text: 'Your own details, as they appear on your ID. Date of birth and street address come from My details, saved on this device only.',
          },
          {
            n: '02',
            top: 263,
            title: 'Declaration of medical fitness',
            status: 'ifCondition',
            text: "Only tick if one applies. If none, the doctor section isn't needed, which is why nothing is ticked here.",
          },
          {
            n: '03',
            top: 453,
            title: 'Medical practitioner declaration',
            status: 'doctor',
            text: 'Only needed if a condition is ticked in 02. The doctor examines you, ticks one result and signs; the red values show a "fit" result.',
          },
        ],
        tags: [{ at: [228, 458.5], text: 'Example · only needed if a condition is ticked' }],
        fields: [
          ...applicantFields('e1', {
            surname: [89.4, 137.2, 234.8, 15.1],
            given: [388.9, 137.2, 161.4, 15.1],
            dob: DOB_P1,
            email: [293.4, 159.2, 254.3, 15.1],
            address: [138.4, 179.6, 409.3, 15.1],
            suburb: [83.5, 199.9, 217.6, 15.1],
            state: [333.8, 199.9, 99.2, 15.1],
            postcode: [482.5, 199.9, 65.2, 15.1],
            phone: [120.3, 220.3, 427.3, 15.1],
          }),
          // conditions (Check Box 18-23): none ticked, on purpose
          { id: 'e1-doctor-name', kind: 'text', ink: 'red', box: [48.9, 468.7, 244.5, 15.1], get: () => EXAMPLE.doctor.name },
          { id: 'e1-doctor-practice', kind: 'text', ink: 'red', box: [309.6, 468.7, 233.1, 15.1], get: () => EXAMPLE.doctor.practice },
          { id: 'e1-doctor-address', kind: 'text', ink: 'red', box: [42.7, 496.0, 491.0, 15.1], get: () => EXAMPLE.doctor.address },
          { id: 'e1-doctor-phone', kind: 'text', ink: 'red', box: [117.6, 516.6, 95.0, 15.1], get: () => EXAMPLE.doctor.phone },
          // unfit [42.7, 590.0] · fit [42.7, 615.7] · fit with conditions [42.7, 641.3]
          { id: 'e1-fit', kind: 'tick', ink: 'red', box: [42.7, 615.7, 11.6, 11.6], on: true },
          { id: 'e1-doctor-date', kind: 'cells', ink: 'red', cells: DOCTOR_DATE, get: () => EXAMPLE.date },
        ],
      },
      {
        n: 2,
        img: '/skippers-forms/eyesight-2.webp',
        caption: 'Page 2 · Eyesight Declaration',
        sections: [
          {
            n: '04',
            top: 125,
            title: "Applicant's details",
            status: 'applicant',
            text: 'The same details again: page 2 can be handed in on its own, so it repeats them.',
          },
          {
            n: '05',
            top: 264,
            title: 'Results of examination',
            status: 'optometrist',
            text: 'The tester writes the number under each 6: 6/6 is normal sight, 6/12 in one eye is the pass mark. "With aids" stays blank when you pass without glasses or contacts.',
          },
          {
            n: '06',
            top: 407,
            title: "Examiner's declaration",
            status: 'optometrist',
            text: 'An optometrist, doctor or registered nurse fills this in, ticks one result and signs it, before the assessment day. The example ticks "HAS met ... without aids to vision".',
          },
          {
            n: '07',
            top: 654,
            title: 'Privacy collection notice',
            status: 'readOnly',
            text: 'Nothing to fill in. It says what the Department keeps and why.',
          },
        ],
        tags: [{ at: [160, 330.5], text: 'Example · the examiner fills this section' }],
        fields: [
          ...applicantFields('e2', {
            surname: [88.8, 137.4, 234.8, 15.1],
            given: [388.3, 137.4, 158.7, 15.1],
            dob: DOB_P2,
            email: [293.7, 159.4, 253.3, 15.1],
            address: [137.8, 179.8, 409.3, 15.1],
            suburb: [82.9, 200.1, 217.6, 15.1],
            state: [333.2, 200.1, 99.2, 15.1],
            postcode: [481.9, 200.1, 65.2, 15.1],
            phone: [119.8, 220.5, 427.3, 15.1],
          }),
          // Letter test, written under the printed "6" (below the diagonal).
          { id: 'e2-right-plain', kind: 'text', ink: 'red', box: [154.5, 373.8, 31.2, 15.1], get: () => '6', align: 'center' },
          { id: 'e2-left-plain', kind: 'text', ink: 'red', box: [227.5, 373.8, 31.2, 15.1], get: () => '6', align: 'center' },
          // with aids (fields at 443.8 and 518.6): left blank on purpose
          { id: 'e2-optom-name', kind: 'text', ink: 'red', box: [47.7, 403.9, 246.1, 15.1], get: () => EXAMPLE.optom.name },
          { id: 'e2-optom-practice', kind: 'text', ink: 'red', box: [309.3, 403.9, 234.8, 15.1], get: () => EXAMPLE.optom.practice },
          { id: 'e2-optom-address', kind: 'text', ink: 'red', box: [42.7, 439.3, 291.3, 15.1], get: () => EXAMPLE.optom.address },
          { id: 'e2-optom-phone', kind: 'text', ink: 'red', box: [419.5, 439.3, 112.4, 15.1], get: () => EXAMPLE.optom.phone },
          // HAS NOT [42.2, 516.6] · HAS met with aids [42.2, 542.2] · HAS met without aids [42.2, 567.9]
          { id: 'e2-met-no-aids', kind: 'tick', ink: 'red', box: [42.2, 567.9, 11.6, 11.6], on: true },
          { id: 'e2-optom-date', kind: 'cells', ink: 'red', cells: OPTOM_DATE, get: () => EXAMPLE.date },
        ],
      },
    ],
  },
  {
    id: 'consent',
    tab: 'Letter of consent',
    title: 'Letter of Consent (under 18s)',
    ref: '09-11-23-RST-0626',
    pdfName: 'RST letter of consent (filled)',
    status: 'Not required for James: over 18. Filled as a worked example.',
    who: 'Only for applicants UNDER 18. A parent or legal guardian signs it by hand, before the assessment.',
    pages: [
      {
        n: 1,
        img: '/skippers-forms/consent-1.webp',
        caption: 'Page 1 · Letter of Consent',
        sections: [
          {
            n: '01',
            top: 125,
            title: 'Who needs this letter',
            status: 'notForJames',
            text: 'Only applicants under 18, signed before the assessment. James is over 18, so this copy is just a worked example.',
          },
          {
            n: '02',
            top: 295,
            title: 'The applicant',
            status: 'applicant',
            text: 'The under-18 applicant\'s name and home address. Number and street come from My details on this device only.',
          },
          {
            n: '03',
            top: 495,
            title: 'Parent or guardian',
            status: 'parent',
            text: 'Tick Parent or Legal Guardian, then print their full name. The red name is an example.',
          },
          {
            n: '04',
            top: 586,
            title: 'Signature and date',
            status: 'parent',
            text: "Sign here by hand. Digital signatures aren't accepted, so the line is left blank. Date it before the assessment day.",
          },
          {
            n: '05',
            top: 680,
            title: 'Privacy collection notice',
            status: 'readOnly',
            text: 'Nothing to fill in. It explains why the Department collects the name and signature.',
          },
        ],
        tags: [{ at: [330, 499.5], text: 'Example · parent or guardian fills this' }],
        annotations: [{ at: [395, 591.5], text: 'Sign by hand · no digital signature' }],
        fields: [
          { id: 'c-family', kind: 'text', ink: 'blue', box: [57.2, 325.6, 231.6, 13.6], get: ({ me }) => me.surname },
          { id: 'c-other', kind: 'text', ink: 'blue', box: [305.4, 325.6, 231.6, 13.6], get: ({ me }) => me.given },
          { id: 'c-number', kind: 'text', ink: 'blue', box: [102.8, 396.7, 99.6, 13.6], get: streetNo, placeholder: 'No.', device: true },
          { id: 'c-street', kind: 'text', ink: 'blue', box: [257.7, 396.0, 279.3, 13.6], get: ({ device }) => device?.street || '', placeholder: 'Street name', device: true },
          { id: 'c-suburb', kind: 'text', ink: 'blue', box: [104.4, 424.1, 432.5, 13.6], get: ({ me }) => me.suburb },
          // printed squares (widget rects are 10.2 x 16.2; see header)
          { id: 'c-parent', kind: 'tick', ink: 'red', box: [57.0, 517.0, 14.0, 14.0], on: true },
          { id: 'c-parent-name', kind: 'text', ink: 'red', box: [116.2, 545.9, 420.8, 13.6], get: () => EXAMPLE.parent },
          { id: 'c-date', kind: 'text', ink: 'red', box: [116.2, 630.6, 196.3, 13.6], get: () => '16/11/2026' },
        ],
      },
    ],
  },
];

export const DEFAULT_FORM = 'eyesight';
