import * as THREE from 'three'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/**
 * The last pass in the chain: lens and film. Runs in linear HDR, then applies
 * the renderer's tone mapping (ACES Filmic) and sRGB output via three's own
 * shader chunks, then adds grain in display space where it reads as grain.
 *
 * One pass rather than four, because on a phone every full-screen pass costs.
 */
export function createFilmPass(small: boolean) {
  const pass = new ShaderPass({
    name: 'FilmPass',
    defines: { ZOOM_SAMPLES: small ? 9 : 14 },
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uVeil: { value: 0 },
      uVeilColor: { value: new THREE.Color(0, 0, 0) },
      uZoom: { value: 0 },
      uDefocus: { value: 0 },
      uCA: { value: 0.0015 },
      uVignette: { value: 0.45 },
      uGrain: { value: 0.05 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uVeil;
      uniform vec3 uVeilColor;
      uniform float uZoom;
      uniform float uDefocus;
      uniform float uCA;
      uniform float uVignette;
      uniform float uGrain;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec2 uv = vUv;
        vec2 toC = uv - 0.5;
        vec3 col;

        if (uZoom > 0.002) {
          // Radial zoom blur: the frame streaks toward the centre on a dive.
          col = vec3(0.0);
          float wsum = 0.0;
          float jitter = hash(uv * uResolution + uTime);
          for (int i = 0; i < ZOOM_SAMPLES; i++) {
            float f = (float(i) + jitter) / float(ZOOM_SAMPLES);
            float w = 1.0 - 0.55 * f;
            col += texture2D(tDiffuse, 0.5 + toC * (1.0 - uZoom * 0.3 * f)).rgb * w;
            wsum += w;
          }
          col /= wsum;
        } else {
          vec2 d = toC * uCA;
          col = vec3(
            texture2D(tDiffuse, uv + d).r,
            texture2D(tDiffuse, uv).g,
            texture2D(tDiffuse, uv - d).b
          );
        }

        if (uDefocus > 0.002) {
          // Cheap rack focus: a golden-angle disc blur, heavier toward the edges.
          float aspect = uResolution.x / uResolution.y;
          float edge = smoothstep(0.08, 0.62, length(toC * vec2(aspect, 1.0)));
          float amt = uDefocus * (0.45 + 0.55 * edge);
          vec2 radius = vec2(0.016 / aspect, 0.016) * amt;
          vec3 b = vec3(0.0);
          float rot = hash(uv * uResolution) * 6.2831;
          for (int i = 0; i < 10; i++) {
            float a = float(i) * 2.39996 + rot;
            float r = sqrt((float(i) + 0.5) / 10.0);
            b += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * radius).rgb;
          }
          col = mix(col, b / 10.0, clamp(amt * 1.6, 0.0, 1.0));
        }

        // Vignette follows the frame's shape, so it works in portrait too.
        float v = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        col *= mix(1.0, pow(clamp(16.0 * v, 0.0, 1.0), 0.28), uVignette);

        col = mix(col, uVeilColor, clamp(uVeil, 0.0, 1.0));

        gl_FragColor = vec4(max(col, 0.0), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>

        float g = hash(uv * uResolution + fract(uTime * 7.31) * 97.0) - 0.5;
        float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb += g * uGrain * (1.0 - 0.55 * lum);
      }
    `,
  })
  return pass
}
