/* ============================================================================
   PROJECTOR LIFE — light on paint (onBeforeCompile patch for the room)
   ----------------------------------------------------------------------------
   Every material in room.surfaceMeshes (unlit MeshBasicMaterial, baked atlas
   or plain colour) gets the same patch and ONE shared uniforms object:

     out = baked · ambient  +  albedo · Σ_projectors light

     light_i = brightness · cosθ · min((W_ref·t)² / d², 3)
               · (black + (1 − black) · output_i(projUV))
               · inFrustum · facing · lit-by-depth-map

   * baked    — what the bake shows (decoded to linear by three).
   * albedo   — derived from the bake: white-balanced so the average inner wall
                reads as the sage paint (#cfdad2), then its luminance softly
                compressed and lifted (a night bake has near-black floor pools
                that are still paint, not holes). Plain-colour materials (the
                new roof, #efede8) ARE paint: albedo = their colour. When the
                room tags a material's meshes with a paint colour
                (userData.pjl.albedo, e.g. walls #cfdad2) the albedo leans 80 %
                to that paint (per-material uniform), so baked shadows don't
                read as dark paint.
   * fall-off — inverse square at the ray distance, scaled by the throw ratio
                (same lumens over a bigger image is dimmer), times cosθ for
                incidence. W_ref = 4 m: brightness 1 = full white on a 4 m
                wide image, perpendicular.
   * black    — a real projector glows grey for black; it falls off with the
                same light, so it shows the frustum footprint.
   * normals  — the GLB has none: face normals from dFdx/dFdy of the world
                position (they face the viewer; a face the projector is
                behind is unlit, which is exactly physical).
   * shadows  — a packed-depth map per projector (shadows.js), 4-tap PCF,
                slope-scaled bias in metres.

   Modes (bit flags): 1 = coverage view (colour by projector count),
   2 = pixel view (projector pixel grid every GRID_PX pixels, tinted by px/m).
   ========================================================================== */

import * as THREE from 'three';
import { FAR } from './projector.js';
import { COVERAGE_LEGEND, GRID_PX, PIXEL_LEGEND } from './legend.js';

export const KEY = 'pjl-light-v1';
export const W_REF = 4.0;
export { COVERAGE_LEGEND, GRID_PX, PIXEL_LEGEND };

// White balance that maps the bake's mean inner-wall colour to the sage paint,
// luminance-neutral (measured from the atlas; see NOTES.md).
const WB = [0.699, 1.085, 1.62];
const ALBEDO_K = 6.0;
const ALBEDO_LIFT = 0.03;

function placeholder(rgba) {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

export function createLightUniforms() {
  const black = placeholder([0, 0, 0, 255]);
  const far = placeholder([255, 255, 255, 255]);
  const v3 = () => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const v4 = () => [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const u = {
    pjlCount: { value: 0 },
    pjlVP: { value: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()] },
    pjlPos: { value: v3() },
    pjlFwd: { value: v3() },
    pjlA: { value: v4() }, // brightness, black, (W_ref·t)², far
    pjlB: { value: v4() }, // throw, res (px wide), depth-map width, aspect
    pjlOut0: { value: black },
    pjlOut1: { value: black },
    pjlOut2: { value: black },
    pjlDep0: { value: far },
    pjlDep1: { value: far },
    pjlDep2: { value: far },
    pjlAmbient: { value: 0.14 },
    pjlMode: { value: 0 },
    pjlOcc: { value: 1 },
    pjlWB: { value: new THREE.Vector3(...WB) },
    pjlAlb: { value: new THREE.Vector2(ALBEDO_K, ALBEDO_LIFT) },
    pjlCov: { value: COVERAGE_LEGEND.map((c) => new THREE.Color(c.color)) },
    pjlHeat: { value: PIXEL_LEGEND.map((c) => new THREE.Color(c.color)) },
    pjlGrid: { value: GRID_PX },
  };
  u.placeholders = { black, far };
  return u;
}

export function disposeLightUniforms(u) {
  u.placeholders.black.dispose();
  u.placeholders.far.dispose();
}

const PARS_VERT = /* glsl */ `
varying vec3 vPjlWorld;
`;

const MAIN_VERT = /* glsl */ `
{
  vec4 pjlP = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    pjlP = batchingMatrix * pjlP;
  #endif
  #ifdef USE_INSTANCING
    pjlP = instanceMatrix * pjlP;
  #endif
  vPjlWorld = ( modelMatrix * pjlP ).xyz;
}
`;

const PARS_FRAG = /* glsl */ `
uniform int pjlCount;
uniform mat4 pjlVP[3];
uniform vec3 pjlPos[3];
uniform vec3 pjlFwd[3];
uniform vec4 pjlA[3];
uniform vec4 pjlB[3];
uniform sampler2D pjlOut0;
uniform sampler2D pjlOut1;
uniform sampler2D pjlOut2;
uniform sampler2D pjlDep0;
uniform sampler2D pjlDep1;
uniform sampler2D pjlDep2;
uniform float pjlAmbient;
uniform int pjlMode;
uniform float pjlOcc;
uniform vec3 pjlWB;
uniform vec2 pjlAlb;
uniform vec3 pjlCov[4];
uniform vec3 pjlHeat[4];
uniform float pjlGrid;
uniform vec4 pjlHint;
varying vec3 vPjlWorld;

struct PjlAcc { vec3 light; float count; float grid; vec3 gridCol; vec3 tint; float tintW; };

float pjlUnpack( vec3 e ) { return dot( e, vec3( 1.0, 1.0 / 255.0, 1.0 / 65025.0 ) ); }
float pjlLuma( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }

vec3 pjlHeatCol( float pxm ) {
  // log ramp: 100 px/m (1 cm pixels) → 1000 px/m (1 mm pixels)
  float t = clamp( ( log2( max( pxm, 1.0 ) ) - 6.643856 ) / 3.321928, 0.0, 1.0 ) * 3.0;
  return t < 1.0 ? mix( pjlHeat[0], pjlHeat[1], t ) : t < 2.0 ? mix( pjlHeat[1], pjlHeat[2], t - 1.0 ) : mix( pjlHeat[2], pjlHeat[3], t - 2.0 );
}

void pjlOne( float pjlOn, mat4 VP, vec3 P, vec3 F, vec4 A, vec4 B, sampler2D outT, sampler2D depT,
             vec3 wp, vec3 N, inout PjlAcc acc ) {
  vec4 clip = VP * vec4( wp, 1.0 );
  float w = max( clip.w, 1e-5 );
  vec2 ndc = clip.xy / w;
  vec2 uv = ndc * 0.5 + 0.5;
  float inF = step( 1e-3, clip.w ) * step( abs( ndc.x ), 1.0 ) * step( abs( ndc.y ), 1.0 );
  vec3 L = P - wp;
  float dist = max( length( L ), 1e-3 );
  float cosT = dot( N, L / dist );

  // occlusion: linear depth along the axis against the projector's depth map
  float zv = dot( wp - P, F );
  vec2 ts = 1.0 / vec2( textureSize( depT, 0 ) );
  float texelM = zv / max( B.x * B.z, 1e-3 );
  float tanT = sqrt( max( 1.0 - cosT * cosT, 0.0 ) ) / max( cosT, 0.08 );
  float bias = 0.012 + texelM * min( tanT, 12.0 ) * 1.5;
  float zt = ( zv - bias ) / A.w;
  float vis = step( zt, pjlUnpack( textureLod( depT, uv + vec2( -0.5, -0.5 ) * ts, 0.0 ).rgb ) )
            + step( zt, pjlUnpack( textureLod( depT, uv + vec2(  0.5, -0.5 ) * ts, 0.0 ).rgb ) )
            + step( zt, pjlUnpack( textureLod( depT, uv + vec2( -0.5,  0.5 ) * ts, 0.0 ).rgb ) )
            + step( zt, pjlUnpack( textureLod( depT, uv + vec2(  0.5,  0.5 ) * ts, 0.0 ).rgb ) );
  float occ = mix( 1.0, vis * 0.25, pjlOcc );

  float reach = pjlOn * inF * occ;
  float v = reach * smoothstep( 0.0, 0.04, cosT );
  vec3 c = textureLod( outT, uv, 0.0 ).rgb;
  float E = A.x * max( cosT, 0.0 ) * min( A.z / ( dist * dist ), 3.0 );
  acc.light += v * E * ( A.y + ( 1.0 - A.y ) * c );
  // soft count (PCF fraction) so coverage edges blend instead of stair-stepping
  float hitSoft = reach * step( 0.0, cosT );
  float hit = step( 0.5, hitSoft );
  acc.count += hitSoft;

  // projector pixel grid: a line every pjlGrid projector pixels
  vec2 g = uv * vec2( B.y, B.y / B.w ) / pjlGrid;
  vec2 fw = max( fwidth( g ), vec2( 1e-5 ) );
  vec2 gd = abs( fract( g - 0.5 ) - 0.5 ) / fw;
  float line = ( 1.0 - min( min( gd.x, gd.y ), 1.0 ) ) * ( 1.0 - smoothstep( 0.2, 0.45, max( fw.x, fw.y ) ) );
  vec3 h = pjlHeatCol( B.y * B.x * max( cosT, 0.0 ) / dist );
  float gl = hit * line;
  acc.gridCol = mix( acc.gridCol, h, step( acc.grid, gl ) * gl );
  acc.grid = max( acc.grid, gl );
  acc.tint += hit * h;
  acc.tintW += hit;
}
`;

const MAIN_FRAG = /* glsl */ `
{
  vec3 pjlN = normalize( cross( dFdx( vPjlWorld ), dFdy( vPjlWorld ) ) );
  PjlAcc acc = PjlAcc( vec3( 0.0 ), 0.0, 0.0, vec3( 0.0 ), vec3( 0.0 ), 0.0 );
  pjlOne( step( 0.5, float( pjlCount ) ), pjlVP[0], pjlPos[0], pjlFwd[0], pjlA[0], pjlB[0], pjlOut0, pjlDep0, vPjlWorld, pjlN, acc );
  pjlOne( step( 1.5, float( pjlCount ) ), pjlVP[1], pjlPos[1], pjlFwd[1], pjlA[1], pjlB[1], pjlOut1, pjlDep1, vPjlWorld, pjlN, acc );
  pjlOne( step( 2.5, float( pjlCount ) ), pjlVP[2], pjlPos[2], pjlFwd[2], pjlA[2], pjlB[2], pjlOut2, pjlDep2, vPjlWorld, pjlN, acc );

  vec3 pjlBaked = outgoingLight;
  #ifdef USE_MAP
    vec3 pjlWb = pjlBaked * pjlWB;
    float pjlLw = pjlLuma( pjlWb );
    float pjlLa = 1.0 - exp( -( pjlLw + pjlAlb.y ) * pjlAlb.x );
    float pjlS = pjlLa / max( pjlLw, 0.02 );
    vec3 pjlAlbedo = clamp( pjlWb * pjlS + vec3( max( pjlLa - pjlLw * pjlS, 0.0 ) ), 0.0, 1.0 );
  #else
    vec3 pjlAlbedo = pjlBaked;
  #endif
  pjlAlbedo = mix( pjlAlbedo, pjlHint.rgb, pjlHint.a );

  vec3 pjlOutC = pjlBaked * pjlAmbient + pjlAlbedo * acc.light;
  float pjlShade = 0.3 + 0.7 * clamp( pjlLuma( pjlAlbedo ) * 1.5, 0.0, 1.0 );
  if ( ( pjlMode & 1 ) != 0 ) {
    float c = clamp( acc.count, 0.0, 3.0 );
    float lo = floor( c );
    vec3 c0 = lo < 0.5 ? pjlCov[0] : lo < 1.5 ? pjlCov[1] : lo < 2.5 ? pjlCov[2] : pjlCov[3];
    vec3 c1 = lo < 0.5 ? pjlCov[1] : lo < 1.5 ? pjlCov[2] : pjlCov[3];
    pjlOutC = mix( c0, c1, c - lo ) * pjlShade;
  }
  if ( ( pjlMode & 2 ) != 0 ) {
    vec3 tint = acc.tint / max( acc.tintW, 1.0 );
    vec3 base = ( pjlMode & 1 ) != 0 ? pjlOutC : pjlBaked * max( pjlAmbient, 0.08 ) * 0.6 + pjlAlbedo * acc.light * 0.3;
    base = mix( base, base * 0.55 + tint * 0.18 * pjlShade, step( 0.5, acc.tintW ) );
    vec3 lineCol = ( pjlMode & 1 ) != 0 ? vec3( 1.0 ) : acc.gridCol;
    pjlOutC = mix( base, lineCol, acc.grid * 0.95 );
  }
  outgoingLight = pjlOutC;
}
`;

const SKIP = /glass/i;

/** Should this material receive projector light? */
export function receivesLight(mat) {
  if (!mat || !mat.isMeshBasicMaterial) return false;
  if (SKIP.test(mat.name || '')) return false;
  return true;
}

// WeakMap, not userData: Material.clone() copies userData (JSON) but never
// onBeforeCompile, so a userData flag would lie on a later clone.
const PATCHED = new WeakMap();
export const HINT_WEIGHT = 0.8;

export function isPatched(mat) {
  return PATCHED.has(mat);
}

/**
 * Patch one material in place (idempotent). Keeps the instance (the room's
 * per-wall fade clones change opacity on it) and composes with any existing
 * onBeforeCompile. `hint` = a paint colour (CSS string) or null; it is this
 * material's own uniform (the rest are shared).
 */
export function patchMaterial(mat, uniforms, hint = null) {
  if (!receivesLight(mat)) return false;
  if (PATCHED.has(mat)) {
    setHint(mat, hint);
    return false;
  }
  const prev = Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
  const prevKey = Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  const hintU = { value: new THREE.Vector4(0, 0, 0, 0) };
  PATCHED.set(mat, { prev, prevKey, hintU });
  setHint(mat, hint);
  mat.onBeforeCompile = (shader, renderer) => {
    if (prev) prev.call(mat, shader, renderer);
    for (const [k, v] of Object.entries(uniforms)) if (k.startsWith('pjl')) shader.uniforms[k] = v;
    shader.uniforms.pjlHint = hintU;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${PARS_VERT}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${MAIN_VERT}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PARS_FRAG}`)
      .replace('#include <opaque_fragment>', `${MAIN_FRAG}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => (prevKey ? `${prevKey.call(mat)}|${KEY}` : KEY);
  mat.needsUpdate = true;
  return true;
}

/** Set (or clear) a patched material's paint-colour hint. */
export function setHint(mat, hint) {
  const rec = PATCHED.get(mat);
  if (!rec) return;
  if (hint) {
    const c = new THREE.Color(hint); // sRGB string → linear working space
    rec.hintU.value.set(c.r, c.g, c.b, HINT_WEIGHT);
  } else rec.hintU.value.set(0, 0, 0, 0);
}

/** Undo patchMaterial (projection disposed while the room lives on). */
export function unpatchMaterial(mat) {
  const rec = mat && PATCHED.get(mat);
  if (!rec) return;
  if (rec.prev) mat.onBeforeCompile = rec.prev;
  else delete mat.onBeforeCompile;
  if (rec.prevKey) mat.customProgramCacheKey = rec.prevKey;
  else delete mat.customProgramCacheKey;
  PATCHED.delete(mat);
  mat.needsUpdate = true;
}

export { FAR };
