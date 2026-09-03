/**
 * The integrations marquee: two rows of platform logos drifting in opposite
 * directions, and the drift speeds up with how fast the page is being
 * scrolled. Modelled on React Bits' ScrollVelocity (which is built on the
 * `motion` library; this is the same idea on gsap's ticker so the page keeps
 * to one animation library).
 *
 * Each row holds three copies of the set so the loop never shows a seam; the
 * row translates by (position mod one set's width). Off-screen rows do not
 * tick at all. Under prefers-reduced-motion the rows stand still and the
 * strip reads as a plain logo wall.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export type MarqueeLogo = { src: string; name: string };

const INTEGRATIONS: MarqueeLogo[] = [
  { src: "/portara-test/integrations/xero.svg", name: "Xero" },
  { src: "/portara-test/integrations/shopify.svg", name: "Shopify" },
  { src: "/portara-test/integrations/hubspot.svg", name: "HubSpot" },
  { src: "/portara-test/integrations/google.png", name: "Google" },
  { src: "/portara-test/integrations/microsoft365.svg", name: "Microsoft 365" },
  { src: "/portara-test/integrations/stripe.svg", name: "Stripe" },
  { src: "/portara-test/integrations/paypal.svg", name: "PayPal" },
  { src: "/portara-test/integrations/klaviyo.png", name: "Klaviyo" },
  { src: "/portara-test/integrations/whatsapp.svg", name: "WhatsApp" },
  { src: "/portara-test/integrations/keap.png", name: "Keap" },
  { src: "/portara-test/integrations/brighthr.png", name: "BrightHR" },
  { src: "/portara-test/integrations/ostendo.svg", name: "Ostendo" },
  { src: "/portara-test/integrations/claude.svg", name: "Claude" },
];

function Logo({ logo }: { logo: MarqueeLogo }) {
  const [failed, setFailed] = useState(false);
  return (
    <li className="marquee__item">
      {failed ? (
        <span className="marquee__name">{logo.name}</span>
      ) : (
        <img
          className="marquee__img"
          src={logo.src}
          alt={logo.name}
          height={28}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <span className="marquee__label">{logo.name}</span>
    </li>
  );
}

function Row({ logos, direction }: { logos: MarqueeLogo[]; direction: 1 | -1 }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const set = setRef.current;
    if (!track || !set) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pos = 0;
    let velocity = 0; // smoothed scroll velocity, px per second
    let lastY = window.scrollY;
    let lastT = performance.now();
    let visible = true;

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      const dy = window.scrollY - lastY;
      // Instantaneous velocity, folded into the smoothed one below.
      velocity = gsap.utils.interpolate(velocity, dy / dt, 0.35);
      lastY = window.scrollY;
      lastT = now;
    };

    const tick = (_time: number, deltaMs: number) => {
      if (!visible) return;
      const dt = deltaMs / 1000;
      velocity = gsap.utils.interpolate(velocity, 0, 0.06); // decay
      // Base drift plus a share of the scroll velocity, in the row's direction.
      const speed = (38 + Math.min(Math.abs(velocity) * 0.18, 260)) * direction;
      pos += speed * dt;
      const w = set.offsetWidth;
      if (w > 0) {
        const wrapped = ((pos % w) + w) % w;
        track.style.transform = `translate3d(${-wrapped}px, 0, 0)`;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { rootMargin: "100px" },
    );
    io.observe(track);
    window.addEventListener("scroll", onScroll, { passive: true });
    gsap.ticker.add(tick);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      gsap.ticker.remove(tick);
    };
  }, [direction]);

  return (
    <div className="marquee__row" aria-hidden={direction === -1 ? true : undefined}>
      <div className="marquee__track" ref={trackRef}>
        <ul className="marquee__set" ref={setRef}>
          {logos.map((l) => (
            <Logo key={l.name} logo={l} />
          ))}
        </ul>
        <ul className="marquee__set" aria-hidden="true">
          {logos.map((l) => (
            <Logo key={l.name} logo={l} />
          ))}
        </ul>
        <ul className="marquee__set" aria-hidden="true">
          {logos.map((l) => (
            <Logo key={l.name} logo={l} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function LogoMarquee() {
  // The second row starts half a set along and runs the other way, so the
  // two never line up.
  const shifted = [...INTEGRATIONS.slice(7), ...INTEGRATIONS.slice(0, 7)];
  return (
    <div className="marquee" aria-label="Platforms Portara integrates with">
      <Row logos={INTEGRATIONS} direction={1} />
      <Row logos={shifted} direction={-1} />
    </div>
  );
}
