/* Dream Rooms · the one post pass (decision 7). A copy of the plan page's
   dreamPass.js (src/components/portal/modules/dream-rooms-plan/), tuned for the
   viewer: soft focus toward the edges, glow from the same taps, radial chromatic
   aberration, a faded grade, vignette, animated grain and the sRGB encode, plus
   three things the viewer needs:
     uWhite      0..1  the whiteout (dissolves, door entries, the wake): the frame
                       softens, lifts and goes to uWhiteColor
     uWhiteGrain       a faint grain shown ON the white (a slow load)
     uBlack      0..1  the opening black (a dream opens on black and sound)
   Fog is not here: it's FogExp2 in the materials. */

export const DreamShader = {
  name: 'DreamRoomsShader',
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: [1, 1] },
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uSoft: { value: 1 },
    uGlow: { value: 0.5 },
    uCA: { value: 0.0055 },
    uGrain: { value: 0.04 },
    uVignette: { value: 0.5 },
    uWhite: { value: 0 },
    uWhiteColor: { value: [0.96, 0.95, 0.92] },
    uWhiteGrain: { value: 0 },
    uBlack: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uAmount, uSoft, uGlow, uCA, uGrain, uVignette, uWhite, uWhiteGrain, uBlack;
    uniform vec3 uWhiteColor;
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
      float w = clamp(uWhite, 0.0, 1.0);

      // radial chromatic aberration (it grows a little as the white comes in)
      vec2 ca = d * uCA * a * (0.4 + r) * (1.0 + w * 1.5);
      vec3 col = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);

      // 12 taps on two rings: soft focus toward the edges + glow from the bright parts. The rings turn
      // by a fixed per-pixel amount (and their radii breathe a little), so a thin bright thing (a sign's
      // lettering, a tube's edge) blooms into a soft, grainy halo instead of being copied at 12 offsets.
      vec2 px = 1.0 / uRes;
      vec3 blur = vec3(0.0);
      vec3 glow = vec3(0.0);
      float jt = hash(floor(vUv * uRes)) * 6.2831853;
      float jr = 0.65 + 0.7 * hash(floor(vUv * uRes) + 17.0);
      for (int i = 0; i < 12; i++) {
        float t = float(i) * 0.5235988 + jt;
        float rad = (i < 6 ? 5.0 : 13.0) * jr * (uRes.y / 900.0) * (1.0 + w * 2.0);
        vec3 s = texture2D(tDiffuse, vUv + vec2(cos(t), sin(t)) * px * rad).rgb;
        blur += s;
        glow += max(s - 0.64, 0.0);
      }
      blur /= 12.0;
      glow /= 12.0;
      col = mix(col, blur, clamp(uSoft * a * (0.07 + r * r * 1.6) + w * 0.85, 0.0, 0.95));
      col += glow * uGlow * a * (2.2 + w * 3.0);

      // faded grade: lift the blacks, pull saturation down a touch, warm the mids
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(l), 0.16 * a);
      col = mix(col, col * vec3(1.03, 1.0, 0.92) + vec3(0.018, 0.016, 0.012), a);

      // vignette (the white is even, so it fades out with it)
      col *= mix(1.0, smoothstep(1.05, 0.25, r), uVignette * a * (1.0 - w));

      // the whiteout: in linear light, eased, so it reads as haze thickening
      float ww = w * w * (3.0 - 2.0 * w);
      col = mix(col, uWhiteColor, ww);

      vec3 outc = toSRGB(col);
      float n = hash(vUv * uRes + fract(uTime) * 97.0) - 0.5;
      outc += n * (uGrain * a * (1.0 - ww) + uWhiteGrain);
      outc *= 1.0 - clamp(uBlack, 0.0, 1.0);
      gl_FragColor = vec4(outc, 1.0);
    }
  `,
};
