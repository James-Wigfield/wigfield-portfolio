/* Dream Rooms · run the headless Blender kit from Node.

     import { findBlender, runBlender, KIT } from './lib/blender.mjs';
     const r = await runBlender('build_world.py', ['--world', abs, '--out', abs, '--draft'], { logFile });
     // r = { code, report, seconds, logFile, tail }
     const m = await measureGlb(file);   // { bytes, drawCalls, triangles, nodes, ... }
     overBudget(m)                        // ['GLB 7.1 MB > 6 MB', ...] (dims.json → budget)

   Blender runs as `blender.exe -b --factory-startup --python <script> -- <args>` (BLENDER overrides
   the path). Its whole log goes to `logFile`, never to the console; the kit's last line is
   `REPORT {json}` (ids, sizes, timings: no dream words, decision 14), parsed into `report`.
   `tail` is the last lines of the log, for a failure message. */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP, KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import dims from '../../../src/dream-rooms/contracts/dims.json' with { type: 'json' };

export const DEFAULT_BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
export const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'blender');

export function findBlender() {
  const p = process.env.BLENDER || DEFAULT_BLENDER;
  if (!fs.existsSync(p)) throw new Error(`Blender not found at ${p} (set BLENDER)`);
  return p;
}

/** Run a kit script (a name in tools/dream-rooms/blender/ or an absolute path). */
export function runBlender(script, args = [], { logFile = null, timeoutS = 1800, onLine = null } = {}) {
  const exe = findBlender();
  const file = path.isAbsolute(script) ? script : path.join(KIT, script);
  if (!fs.existsSync(file)) throw new Error(`no kit script ${file}`);
  const argv = ['-b', '--factory-startup', '--python', file, '--', ...args.map(String)];
  if (logFile) fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = logFile ? fs.createWriteStream(logFile) : null;
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(exe, argv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let report = null;
    const tail = [];
    let buf = '';
    const eat = (chunk) => {
      log?.write(chunk);
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        if (line.startsWith('REPORT ')) {
          try {
            report = JSON.parse(line.slice(7));
          } catch {
            /* a truncated report stays null */
          }
        } else if (line.trim()) {
          tail.push(line);
          if (tail.length > 40) tail.shift();
          if (onLine && line.startsWith('[dr ')) onLine(line);
        }
      }
    };
    child.stdout.on('data', eat);
    child.stderr.on('data', eat);
    const timer = setTimeout(() => {
      child.kill();
    }, timeoutS * 1000);
    child.on('error', (err) => {
      clearTimeout(timer);
      log?.end();
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (buf) eat('\n');
      log?.end();
      resolve({ code, report, seconds: Math.round((Date.now() - t0) / 100) / 10, logFile, tail });
    });
  });
}

/** The real GLB: bytes, draw calls (primitives of every mesh instance), triangles, nodes. */
export async function measureGlb(file) {
  // Blender writes WebP textures (EXT_texture_webp) next to the Khronos ones (KHR_materials_unlit)
  const io = new NodeIO().registerExtensions([...KHRONOS_EXTENSIONS, EXTTextureWebP]);
  const doc = await io.read(file);
  const root = doc.getRoot();
  let drawCalls = 0;
  let triangles = 0;
  const names = [];
  const visit = (node) => {
    names.push(node.getName());
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        drawCalls += 1;
        const mode = prim.getMode();
        const idx = prim.getIndices();
        const count = idx ? idx.getCount() : prim.getAttribute('POSITION')?.getCount() || 0;
        if (mode === 4) triangles += count / 3;
        else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
      }
    }
    for (const c of node.listChildren()) visit(c);
  };
  for (const scene of root.listScenes()) for (const n of scene.listChildren()) visit(n);
  return {
    bytes: fs.statSync(file).size,
    drawCalls,
    triangles: Math.round(triangles),
    nodes: names,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    unlit: root.listMaterials().filter((m) => m.getExtension('KHR_materials_unlit')).length,
  };
}

export function overBudget(m, budget = dims.budget) {
  const over = [];
  if (m.bytes > budget.glbBytes) over.push(`GLB ${(m.bytes / 1048576).toFixed(2)} MB > ${(budget.glbBytes / 1048576).toFixed(0)} MB`);
  if (m.drawCalls > budget.drawCalls) over.push(`${m.drawCalls} draw calls > ${budget.drawCalls}`);
  if (m.triangles > budget.triangles) over.push(`${m.triangles} triangles > ${budget.triangles}`);
  return over;
}
