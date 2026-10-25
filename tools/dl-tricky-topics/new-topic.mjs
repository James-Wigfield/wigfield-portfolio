/* ============================================================================
   DL TRICKY TOPICS — scaffold a new topic
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"
     node tools/dl-tricky-topics/new-topic.mjs --remove <id>

   Copies topics/_template to topics/<id>/, fills in the id and the title
   (every __TOPIC_ID__ / __TOPIC_TITLE__), and appends the topic's line to
   topics/index.js — the only list that names topics, read by the tab bar,
   the deep links, the progress marks and every check. The new topic renders
   straight away at /portal/dl-tricky-topics/<id> with placeholder content
   marked "REPLACE ME". Then follow ADDING-A-TOPIC.md.

   --remove deletes topics/<id>/ and its line in topics/index.js (for a
   throwaway topic). It refuses _template, the four built-in topics and
   any topic already committed to git.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/tricky-topics');
const TOPICS = path.join(ROOT, 'topics');
const INDEX = path.join(TOPICS, 'index.js');
const PROTECTED = ['_template', 'param-count', 'shapes', 'softmax', 'stride'];

const die = (msg) => {
  console.error(`new-topic: ${msg}`);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args[0] === '--remove') {
  const id = args[1];
  if (!id || PROTECTED.includes(id)) die(`refusing to remove "${id ?? ''}"`);
  const dir = path.join(TOPICS, id);
  // never delete a topic that is already committed: only throwaway, uncommitted ones
  try {
    const tracked = execFileSync('git', ['ls-files', '--', dir], { cwd: ROOT }).toString().trim();
    if (tracked) die(`topics/${id}/ is committed to git; refusing to remove it (use git if you really mean it)`);
  } catch (e) {
    if (e.status === undefined) die(`couldn't ask git whether topics/${id}/ is committed (${e.message})`);
    throw e;
  }
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  const src = fs.readFileSync(INDEX, 'utf8');
  const lines = src.split(/\r?\n/);
  const kept = lines.filter((l) => !l.includes(`id: '${id}'`));
  fs.writeFileSync(INDEX, kept.join(src.includes('\r\n') ? '\r\n' : '\n'));
  console.log(`removed topics/${id}/ and its line in topics/index.js (${lines.length - kept.length} line)`);
  process.exit(0);
}

const [id, title] = args;
if (!id || !title) die('usage: node tools/dl-tricky-topics/new-topic.mjs <id> "<Title>"');
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) die(`the id must be kebab-case (letters, digits, hyphens): "${id}"`);
if (id.length > 40) die('keep the id under 40 characters');
const dest = path.join(TOPICS, id);
if (fs.existsSync(dest)) die(`topics/${id}/ already exists`);
const index = fs.readFileSync(INDEX, 'utf8');
if (index.includes(`id: '${id}'`)) die(`topics/index.js already lists "${id}"`);

// 1. copy the template, filling in the id and the title
const safeTitle = title.replace(/\\/g, '').replace(/'/g, '’').replace(/`/g, '');
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const a = path.join(from, name);
    const b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copy(a, b);
    else fs.writeFileSync(b, fs.readFileSync(a, 'utf8').replaceAll('__TOPIC_ID__', id).replaceAll('__TOPIC_TITLE__', safeTitle));
  }
}
copy(path.join(TOPICS, '_template'), dest);

// 2. append the topic's line to topics/index.js (just before the list closes)
const eol = index.includes('\r\n') ? '\r\n' : '\n';
const line = `  { id: '${id}', title: '${safeTitle}', lectures: ['L1'], blurb: 'REPLACE ME: one line on ${safeTitle}.', load: () => import('./${id}/index.js') },`;
const close = index.lastIndexOf('];');
if (close === -1) die('could not find the end of the TOPICS list in topics/index.js');
const before = index.slice(0, close).replace(/\s*$/, '');
fs.writeFileSync(INDEX, `${before}${eol}${line}${eol}${index.slice(close)}`);

console.log(`created topics/${id}/ (a copy of _template) and added it to topics/index.js
  open   /portal/dl-tricky-topics/${id}
  next   fill in topic.js, labs/, drill.js, sheets/, exportPrompt.js, and the
         lectures + blurb on its line in topics/index.js (ADDING-A-TOPIC.md)
  check  node tools/dl-tricky-topics/check-maths.mjs
         SITE_URL=http://localhost:5184 node tools/dl-tricky-topics/page-check.mjs`);
