/* ============================================================================
   RESUME - CONTENT (every word of both versions; Resume.jsx is layout only)
   ----------------------------------------------------------------------------
   Shape of a version:
     id, tab, short, label    switch + toolbar text
     updated, updatedText     ISO date + the printed "last updated" date
     pdfName                  document.title while printing = the PDF's file name
     about                    one line above the document (screen only)
     person                   { name, contact: [..] } (contact prints joined by ' | ')
     summary?, summaryTitle?  a first section with one paragraph (title 'Summary')
     sections                 [{ title, lede?, keep?, entries?, facts?, list? }]
                              entry: { org, when?, role?, lines?, bullets? }
                              facts / list: [{ k?, v }], printed as bullets
                              "**label**: text", like the doc's labelled lines
     notes?                   screen-only notes under the document

   "{{confirm: text}}" anywhere marks a fact still to be confirmed; it renders
   as a highlighted placeholder (screen and print). Never use em-dashes here.
   ========================================================================== */

export const DEFAULT_VERSION = 'v2';

/* ── Version 1: the Google Doc "James Wigfield Resume" (Personal folder),
   last edited 27 January 2026. Same content, same order. Only obvious typos
   fixed: "Javascript" -> "JavaScript", "swift" -> "Swift", a double space. */
const V1 = {
  id: 'v1',
  tab: 'Version 1',
  short: 'Original · Jan 2026',
  label: 'Version 1 · original resume',
  updated: '2026-01-27',
  updatedText: '27 January 2026',
  pdfName: 'James Wigfield - Resume (v1, Jan 2026)',
  about:
    'The resume exactly as it stands in the Google Doc, last edited 27 January 2026. Kept for reference; version 2 replaces it.',
  person: {
    name: 'James Wigfield',
    contact: ['jameswigfield1@gmail.com', '0455 887 910'],
  },
  sections: [
    {
      title: 'Education',
      entries: [
        {
          org: 'University of Western Australia',
          when: 'February 2022 - November 2026 (expected)',
          role: 'B.S. Advanced Computer Science',
          lines: ['Major in Artificial Intelligence'],
          bullets: [
            '**GPA**: 5.0/7.0',
            '**Relevant Coursework**: Natural Language Processing, Computer Vision, Professional Computing',
          ],
        },
        {
          org: 'Peter Carnley Anglican Community School',
          when: '2021 graduate',
          bullets: [
            '**ATAR**: 93.2 (top of the class for Computer Science, Physics, Chemistry)',
            '**Awards/Roles**: Academic Dux of the Year, Head Boy (year 12)',
          ],
        },
      ],
    },
    {
      title: 'Leadership & Work Experience',
      entries: [
        {
          org: 'Rockingham Kwinana Mobility (RKMRS)',
          when: 'February 2024 - present',
          role: 'IT Manager',
          bullets: [
            'Engineered a centralized Staff Portal to digitize internal workflows, migrating 100% of paper forms to dynamic, logic-based digital solutions using Jotform and SharePoint integration.',
            'Developed a custom AI agent to assist staff with internal queries to reduce time spent on information retrieval.',
            'Created a Progressive Web App so staff have quick access to links, forms, and the AI agent. This was primarily designed for the delivery drivers who need quick and easy access to specific forms.',
          ],
        },
        {
          org: 'GoFlo Solutions',
          when: 'August 2025 - present',
          role: 'Co-Founder & Lead Automation Engineer',
          bullets: [
            'Co-founded an AI automation agency, led the technical scoping, architecture, and deployment of workflow solutions for small business clients.',
            'Designed custom automation scripts using Google Apps Script, n8n, Power Automate, JavaScript to integrate business software, directly improving client operational efficiency.',
            'Managed the full software development lifecycle (SDLC) for client projects, handling requirements gathering, rapid prototyping, and final delivery within strict timelines.',
          ],
        },
        {
          org: 'Ace Cinemas Rockingham',
          when: 'June 2019 - January 2025',
          role: 'Location Team Leader',
          bullets: [
            'Supervised a team of staff in a high-volume retail environment, overseeing conflict resolution, maintaining customer service standards, and facilitating staff training.',
          ],
        },
      ],
    },
    {
      title: 'Projects',
      entries: [
        {
          org: 'NLP Sentiment Analysis Model (University Project)',
          bullets: [
            'Built a deep learning model to analyse text sentiment using Natural Language Processing techniques in PyTorch. The focus was on data normalisation, tokenisation and model architecture design.',
            'Implemented Variational Siamese Auto-Encoder (VSAE) model to achieve high accuracy on the validation dataset.',
          ],
        },
      ],
    },
    {
      title: 'Additional Information',
      list: [
        { k: 'Languages', v: 'Python, JavaScript, HTML, CSS, SQL, React, Java, Swift' },
        { k: 'Study Abroad', v: 'Studied at the University of Leeds, UK for semester 1 2025 (6 months)' },
        { k: 'Online Study', v: 'currently working through a Udemy course for React, Next.js, Redux (20% complete)' },
      ],
    },
  ],
};

/* ── Version 2: current, for the Portara technology liability application
   (directors' CVs requested by the broker, 20 Nov 2026). Every line was
   researched against a source and then checked by an independent reader;
   see `notes` for what still needs James's confirmation. */
const V2 = {
  id: 'v2',
  tab: 'Version 2',
  short: 'Current · Nov 2026',
  label: 'Version 2 · current',
  updated: '2026-11-20',
  updatedText: '20 November 2026',
  pdfName: 'James Wigfield - CV (Nov 2026)',
  about:
    "Current CV, written for the directors' CVs the insurers asked for in the Portara technology liability application. Every line is sourced and was checked by an independent reader; highlighted text still needs confirming before it is sent.",
  person: {
    name: 'James Wigfield',
    contact: ['Perth, Western Australia', 'james@portara.com.au', '0455 887 910', 'linkedin.com/in/james-wigfield-66381737a'],
  },
  summary:
    'Co-founder and director of Portara Pty Ltd, a Perth company that builds custom staff portals with AI agents for Western Australian businesses. I lead client discovery, solution design, pricing and client agreements, and I contribute code to the platform, including security fixes. Platform engineering and security decisions are led by my co-director, Justin Steyn. As IT Manager of Rockingham Kwinana Mobility from February 2024 I built its staff portal and a staff AI assistant. I am in the final stage of a Bachelor of Advanced Computer Science (Honours) at the University of Western Australia, majoring in Artificial Intelligence.',
  sections: [
    {
      title: 'Experience',
      entries: [
        {
          org: 'Portara Pty Ltd (ACN 700 346 621)',
          when: 'July 2026 - present',
          role: 'Co-founder and Director',
          lines: [
            'Perth company, registered on {{confirm: 15 July 2026}}, with two working directors (James Wigfield and Justin Steyn). Each client portal runs as its own Cloudflare Worker (a separate serverless application) with its own schema in one Supabase PostgreSQL database hosted in Sydney.',
          ],
          bullets: [
            'Lead client discovery, portal solution design, pricing and client agreements. Four clients have signed prototype agreements since August 2026, and the first pilot agreement was signed in November 2026.',
            'Drafted the Prototype Agreement (August 2026) and redlined the Pilot Agreement (October to November 2026).',
            'Built the first client prototype portal (August to September 2026) and the first stages of an internal meeting-assistant prototype (live transcription and a synthesised voice).',
          ],
        },
        {
          org: 'SafeStyle, Perth',
          when: 'February 2026 - {{confirm: present}}',
          role: 'Junior Software Developer',
          bullets: ['Build and maintain production software as part of a commercial engineering team.'],
        },
        {
          org: 'Rockingham Kwinana Mobility (RKMRS), Rockingham',
          when: 'February 2024 - {{confirm: February 2026}}',
          role: 'IT Manager',
          lines: ['Mobility equipment servicing and repair business (scooters, wheelchairs, beds and other aids). Now a Portara pilot client.'],
          bullets: [
            "Built a centralised staff portal that moved the business's paper forms to logic-based digital forms, using Jotform with SharePoint integration.",
            'Developed a custom AI agent that answers staff questions about internal information.',
            'Created a Progressive Web App giving staff, mainly the delivery drivers, quick access to links, forms and the AI agent.',
          ],
        },
        {
          org: 'GoFlo Solutions',
          when: '{{confirm: August 2025}} - {{confirm: July 2026}}',
          role: 'Co-founder',
          bullets: [
            'Co-founded a small AI and workflow automation business. Scoped automation work for small-business clients and built prototypes, including a proposal-document auto-fill.',
          ],
        },
        {
          org: 'Ace Cinemas Rockingham',
          when: 'June 2019 - January 2025',
          role: 'Location Team Leader',
          bullets: ['Supervised a team of staff in a high-volume retail venue: conflict resolution, customer service standards and staff training.'],
        },
      ],
    },
    {
      title: 'Security and data protection',
      lede: 'Work I did myself on the Portara platform and on one research tool. Portara has not yet had an independent penetration test.',
      list: [
        {
          k: 'Code review and fixes, August 2026',
          v: 'Ran an internal, AI-assisted security review of the platform code and wrote fixes for its findings: closing a path for a client administrator to gain Portara staff access, a database permission check before AI agent settings can change, stopping client settings from reaching a command line, and security response headers. A further finding (agent runs started without signing in) was closed by my co-director. The fixes were live by 8 August 2026, before the first Portara client agreement was signed (17 August 2026).',
        },
        {
          k: 'Sign-in, August 2026',
          v: 'Fixed sign-in defects so that an account with no portal access is now refused before a one-time code is spent, and the invite and password-reset flows were repaired.',
        },
        {
          k: 'Privacy, November 2026',
          v: 'Updated the Privacy Policy and Terms of Service to version 1.3.',
        },
        {
          k: 'Research tool, July 2026',
          v: 'CAIC Command, a compute booking tool for the UWA Medical Physics Research Group: sign-in through GitHub, signed session cookies, database row-level security enabled, and the database service key kept on the server.',
        },
      ],
    },
    {
      title: 'Education',
      entries: [
        {
          org: 'University of Western Australia',
          when: '{{confirm: February 2022}} - completing {{confirm: end of 2026}}',
          role: 'Bachelor of Advanced Computer Science (Honours), Major in Artificial Intelligence',
          bullets: [
            'Honours research (2026), AI for medical imaging: "Do Mamba Blocks Earn Their Place? A Hybrid CNN-Mamba Network for Whole-Body PSMA PET/CT Lesion Segmentation", a deep-learning model that outlines prostate cancer lesions in PET/CT scans. Supervised by Dr Jake Kendrick and Dr Mubashar Hassan.',
            'Units in 2026 include Machine Learning, Deep Learning, and Artificial Intelligence and Adaptive Systems. Earlier units include {{confirm: Natural Language Processing, Computer Vision and Professional Computing}}.',
            'GPA {{confirm: 5.0}} / 7.0.',
          ],
        },
        {
          org: 'University of Leeds, United Kingdom',
          when: 'January - June 2025',
          role: 'Study abroad, Computing',
          bullets: ['Units included Data Mining, Discrete Mathematics with Computation, and Introduction to Enterprise and Entrepreneurship.'],
        },
        {
          org: 'Peter Carnley Anglican Community School',
          when: '2021',
          bullets: ['ATAR 93.2. Academic Dux and Head Boy.'],
        },
      ],
    },
    {
      title: 'Skills',
      keep: true,
      facts: [
        { k: 'Software', v: 'JavaScript, TypeScript, React, Python, SQL, HTML and CSS.' },
        { k: 'Platforms', v: 'Cloudflare Workers and Durable Objects (serverless hosting), Supabase (managed PostgreSQL), Git and GitHub.' },
        { k: 'AI and ML', v: 'PyTorch, TensorFlow and Keras; LLM agents and MCP servers (tool connections for AI models).' },
        { k: 'Automation', v: 'Jotform, {{confirm: SharePoint, Power Automate, n8n and Google Apps Script}}.' },
      ],
    },
  ],
  notes: [
    'Resolve every highlighted item before this goes to the broker. The highlight prints, so an unconfirmed line cannot go out looking final.',
    "Keep this CV and Portara's business plan in step: the plan's director profile leaves out SafeStyle and lists the RKMRS role as possibly continuing.",
    "Sources: the Google Doc resume (Jan 2026), Portara's repo, git history and business plan, the UWA research proposal and dissertation, the Leeds transcript, Gmail and Notion. Each line was checked by an independent reader.",
    'Left out of this version for lack of evidence: the NLP sentiment (VSAE) project, Java and Swift, the Udemy course. Also left out: commit counts and contract version numbers.',
  ],
};

export const VERSIONS = [V2, V1];
