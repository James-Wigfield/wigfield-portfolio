import { Frame, Words } from '../engine/Words';
import { fade, frameIn, gsap, grow, pop, rise, useSlide, wordsIn } from '../engine/motion';
import { FemurArt } from '../art/FemurArt';

/* ============================================================================
   CHAPTER 6 — CLOSE: conclusion (the femur from the title returns, its
   stress lines thickening) and the corrected reference list.
   ========================================================================== */

/* ── 19. Conclusion ───────────────────────────────────────────────────────── */

const HAVE = ['Resistance training', 'Functional strengthening', 'Balance', 'Obstacle course', 'Dual-tasking'];
const NEXT = [
  ['Add appropriately prescribed impact', 'controlled foot stamping, heel drops'],
  ['Add seated trunk and back-extensor work', 'bracing, pelvic tilts, sitting tall'],
  ['Keep challenging balance', 'multidirectional stepping, obstacles, dual-task work'],
  ['Make the dose count', 'enough stimulus for ongoing gains in strength and function'],
];

const CO_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      wordsIn(t, q('[data-a="lead"] .cs-wi'), 0.3, { stagger: 0.035 });
      pop(t, q('[data-a="have"] .dot'), 0.9, { s: 0.2, stagger: 0.1 });
      rise(t, q('[data-a="have"] span:not(.dot)'), 0.95, { y: 8, stagger: 0.1 });
      fade(t, q('[data-a="fem"]'), 0.4, { d: 1.2 });
    },
    (t, q) => {
      q('[data-a="nrow"]').forEach((r, i) => {
        const at = i * 0.4;
        grow(t, r.querySelector('[data-a="nrule"]'), at, { d: 0.8 });
        rise(t, r.querySelectorAll('[data-a="ntxt"]'), at + 0.1, { y: 14, stagger: 0.08 });
      });
      rise(t, q('[data-a="care"]'), 1.7, { y: 10 });
      t.fromTo(q('[data-a="fem"] [data-a="trab"]'), { attr: { 'stroke-width': 3.2 } }, { attr: { 'stroke-width': 5.4 }, duration: 1.6, ease: 'power2.inOut', stagger: 0.02 }, 0.2);
    },
    (t, q) => {
      grow(t, q('[data-a="aimrule"]'), 0, { d: 1 });
      wordsIn(t, q('[data-a="aim"] .cs-wi'), 0.15, { stagger: 0.035 });
      t.fromTo(q('[data-a="thanks"]'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out' }, 1.3);
    },
  ],
  ambient: ({ q, delay }) => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: delay + 0.4 });
    tl.fromTo(q('[data-a="pulse"]'), { autoAlpha: 1, drawSVG: '0% 0%' }, { drawSVG: '0% 22%', duration: 0.35, ease: 'none', stagger: 0.07 }, 0)
      .to(q('[data-a="pulse"]'), { drawSVG: '78% 100%', duration: 1.2, ease: 'power1.inOut', stagger: 0.07 }, 0.35)
      .to(q('[data-a="pulse"]'), { drawSVG: '100% 100%', duration: 0.4, ease: 'none', stagger: 0.07 }, 1.55)
      .set(q('[data-a="pulse"]'), { autoAlpha: 0 });
    gsap.to(q('[data-a="reticle"]'), { rotation: 360, svgOrigin: '170 195', duration: 90, ease: 'none', repeat: -1, delay });
  },
};

export function ConclusionSlide({ ctx, meta }) {
  const root = useSlide(ctx, CO_CFG);
  return (
    <div className="cs-stage s-co" ref={root}>
      <Frame meta={meta} title="Building on a strong foundation" foot="Falls prevention: Montero-Odasso et al. (2022), World guidelines for falls prevention and management for older adults." />
      <p className="s-co__lead" data-a="lead">
        <Words text="GER360 already covers *most* of what falls-prevention guidelines recommend." />
      </p>
      <p className="s-co__have" data-a="have">
        {HAVE.map((h) => (
          <span key={h} className="s-co__hv"><span className="dot dot--move" /><span>{h}</span></span>
        ))}
      </p>
      {NEXT.map(([k, v], i) => (
        <div className="s-co__row" key={k} style={{ top: 470 + i * 84 }} data-a="nrow">
          <span className="s-co__nrule" data-a="nrule" />
          <p className="s-co__n t-mono" data-a="ntxt">0{i + 1}</p>
          <p className="s-co__k" data-a="ntxt">{k}</p>
          <p className="s-co__v" data-a="ntxt">{v}</p>
        </div>
      ))}
      <p className="s-co__care" data-a="care"><span className="dot dot--risk" />Introduce impact carefully, especially for anyone with vertebral fractures.</p>
      <span className="s-co__aimrule" data-a="aimrule" />
      <p className="s-co__aim" data-a="aim">
        <Words text="Help older adults keep their *strength,* *mobility* and *independence,* and reduce their risk of falls and fragility fractures." />
      </p>
      <div className="s-co__fem" data-a="fem">
        <FemurArt x={0} y={0} load={false} />
      </div>
      <p className="s-co__thanks" data-a="thanks">Thank you</p>
    </div>
  );
}
ConclusionSlide.beats = CO_CFG.beats.length;

/* ── 20. References ───────────────────────────────────────────────────────── */

const REFS = [
  'Australian Government Department of Health, Disability and Ageing. (2026, March 16). *Recommendations for older adults (65 years and over).* https://www.health.gov.au/topics/physical-activity/24-hour-movement-guidelines-for-all-australians/recommendations-for-older-adults-65-years-and-over',
  'Cohen, J. (1988). *Statistical power analysis for the behavioral sciences* (2nd ed.). Lawrence Erlbaum Associates.',
  'Dawson, R., Suen, J., Sherrington, C., Kwok, W., Pinheiro, M. B., Haynes, A., McLennan, C., Sutcliffe, K., Kneale, D., & Dyer, S. (2024). Effective fall prevention exercise in residential aged care: An intervention component analysis from an updated systematic review. *British Journal of Sports Medicine, 58*(12), 641–648. https://doi.org/10.1136/bjsports-2023-107505',
  'Harvey, L., Harris, I. A., Mitchell, R. J., Webster, A., Cameron, I. D., Jorm, L., Seymour, H., Sarrami, P., & Close, J. (2022). Improved survival rates after hip fracture surgery in New South Wales, 2011–2018. *Medical Journal of Australia, 216*(8), 420–421. https://doi.org/10.5694/mja2.51440',
  'Healthy Bones Australia. (2024). *Exercise prescription to support the management of osteoporosis: For physiotherapists and exercise physiologists.* https://healthybonesaustralia.org.au/wp-content/uploads/2024/02/hba-ex-presc-final-compressed.pdf',
  'Lindberg, P. W. S., Michelet, K. M., Alin, C. K., Andersson, E., Grahn Kronhed, A.-C., Magnusson, P., Nyrén, S., Lundin, H. R., Toth-Pal, E., Sääf, M., & Salminen, H. (2026). The effect of OsteoStrong compared to dynamic multicomponent exercise on bone strength in older women: The BONEMORE non-inferiority randomized controlled trial. *Archives of Osteoporosis, 21*(1), Article 46. https://doi.org/10.1007/s11657-026-01679-9',
  'Montero-Odasso, M., van der Velde, N., Martin, F. C., Petrovic, M., Tan, M. P., Ryg, J., Aguilar-Navarro, S., Alexander, N. B., Becker, C., Blain, H., Bourke, R., Cameron, I. D., Camicioli, R., Clemson, L., Close, J., Delbaere, K., Duan, L., Duque, G., Dyer, S. M., . . . Task Force on Global Guidelines for Falls in Older Adults. (2022). World guidelines for falls prevention and management for older adults: A global initiative. *Age and Ageing, 51*(9), Article afac205. https://doi.org/10.1093/ageing/afac205',
  'Ng, C. A. C. M., Fairhall, N., Wallbank, G., Tiedemann, A., Michaleff, Z. A., & Sherrington, C. (2019). Exercise for falls prevention in community-dwelling older adults: Trial and participant characteristics, interventions and bias in clinical trials from a systematic review. *BMJ Open Sport & Exercise Medicine, 5*(1), Article e000663. https://doi.org/10.1136/bmjsem-2019-000663',
  "O'Bryan, S. J., Giuliano, C., Woessner, M. N., Vogrin, S., Smith, C., Duque, G., & Levinger, I. (2022). Progressive resistance training for concomitant increases in muscle strength and bone mineral density in older adults: A systematic review and meta-analysis. *Sports Medicine, 52*(8), 1939–1960. https://doi.org/10.1007/s40279-022-01675-2",
  'Pinheiro, M. B., Oliveira, J., Bauman, A., Fairhall, N., Kwok, W., & Sherrington, C. (2020). Evidence on physical activity and osteoporosis prevention for people aged 65+ years: A systematic review to inform the WHO guidelines on physical activity and sedentary behaviour. *International Journal of Behavioral Nutrition and Physical Activity, 17*(1), Article 150. https://doi.org/10.1186/s12966-020-01040-4',
  'Wong, P., Chen, W., Ewald, D., Girgis, C., Rawlin, M., Tsingos, J., & Waters, J. (2025). 2024 Royal Australian College of General Practitioners and Healthy Bones Australia guideline for osteoporosis management and fracture prevention in postmenopausal women and men over 50 years of age. *Medical Journal of Australia, 222*(9), 472–480. https://doi.org/10.5694/mja2.52637',
  'World Health Organization. (1994). *Assessment of fracture risk and its application to screening for postmenopausal osteoporosis* (WHO Technical Report Series No. 843).',
];

/** `*text*` in a reference renders in italics (APA titles, journals, volumes). */
function Ref({ text }) {
  return text.split('*').map((part, i) => (i % 2 ? <i key={i}>{part}</i> : <span key={i}>{part}</span>));
}

const RF_CFG = {
  beats: [
    (t, q) => {
      frameIn(t, q);
      rise(t, q('[data-a="ref"]'), 0.3, { y: 12, stagger: 0.05 });
    },
  ],
};

export function RefsSlide({ ctx, meta }) {
  const root = useSlide(ctx, RF_CFG);
  return (
    <div className="cs-stage s-rf" ref={root}>
      <Frame meta={meta} title="References" foot="Illustrations are original schematics made for this talk." />
      <ul className="s-rf__list">
        {REFS.map((r) => <li key={r.slice(0, 40)} data-a="ref"><Ref text={r} /></li>)}
      </ul>
    </div>
  );
}
RefsSlide.beats = RF_CFG.beats.length;
