/* ============================================================================
   DREAM PASS — every post effect in ONE full-screen shader.
   ----------------------------------------------------------------------------
   Plan-page sketch of the browser half of the look (the build prompt asks the
   real viewer for the same idea). One pass instead of a stack: soft focus that
   grows toward the edges, a cheap glow from the same taps, radial chromatic
   aberration, a faded grade (lifted blacks, a little desaturation), vignette
   and animated grain, then linear → sRGB. Fog is not here: it's FogExp2 in
   the materials, which costs nothing extra.
   tools/dream-rooms-plan/bench.html measures it against three's stock stack.
   ========================================================================== */

export const DreamShader = {
  name: 'DreamShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: [1, 1] },
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uSoft: { value: 1 },
    uGlow: { value: 0.55 },
    uCA: { value: 0.006 },
    uGrain: { value: 0.07 },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uAmount, uSoft, uGlow, uCA, uGrain, uVignette;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 toSRGB(vec3 c) {
      c = max(c, 0.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(uRes.x / uRes.y, 1.0)) * 1.2;
      float a = uAmount;

      // radial chromatic aberration
      vec2 ca = d * uCA * a * (0.4 + r);
      vec3 col = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);

      // 12 taps on two rings: soft focus toward the edges + glow from the bright parts
      vec2 px = 1.0 / uRes;
      vec3 blur = vec3(0.0);
      vec3 glow = vec3(0.0);
      for (int i = 0; i < 12; i++) {
        float t = float(i) * 0.5235988 + 0.3;
        float rad = (i < 6 ? 5.0 : 13.0) * (uRes.y / 900.0);
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(t), sin(t)) * px * rad).rgb;
        blur += s;
        glow += max(s - 0.62, 0.0);
      }
      blur /= 12.0;
      glow /= 12.0;
      col = mix(col, blur, clamp(uSoft * a * (0.18 + r * r * 1.6), 0.0, 0.92));
      col += glow * uGlow * a * 2.2;

      // faded grade: lift the blacks, pull saturation down a touch, warm the mids
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(l), 0.16 * a);
      col = mix(col, col * vec3(1.03, 1.0, 0.92) + vec3(0.018, 0.016, 0.012), a);

      // vignette
      col *= mix(1.0, smoothstep(1.05, 0.25, r), uVignette * a);

      vec3 outc = toSRGB(col);
      // animated grain, after the encode so it reads evenly in the darks
      outc += (hash(vUv * uRes + fract(uTime) * 97.0) - 0.5) * uGrain * a;
      gl_FragColor = vec4(outc, 1.0);
    }
  `,
};
