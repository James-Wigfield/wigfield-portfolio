/**
 * Every tuning value for the portlets, in one place: how often they come out,
 * how they walk and turn, how the body rides, how far they reach, how each
 * job is timed. Nothing elsewhere in portlets/ carries a magic number about
 * feel; if it does, move it here.
 *
 * Units: world units unless a comment says otherwise (a portlet is `height`
 * tall; the word's cap is about 0.64), seconds, radians (given in degrees
 * through deg()).
 */
const deg = (d: number) => (d * Math.PI) / 180;

export const PORTLET_CONFIG = {
  /** Height of a portlet. Under the lowest ring of letters (0.67 up). */
  height: 0.55,

  /**
   * Who comes out and when (PortletManager). The portal is quiet most of the
   * time. When it is empty, nothing happens until a random quiet gap has
   * passed; then an OUTING begins, whose size is drawn from `outingWeights`
   * (one out is the common case, three is rare). Companions join on a timer
   * check, each after its own random gap and only by chance per check; a
   * third joins only when the other two are both mid-job and an extra
   * cooldown has passed. Nobody is queued by anybody leaving: spawning is
   * a probabilistic check on a timer, and the quiet gap is simply how long
   * the empty portal is left alone.
   */
  pool: {
    maxActive: 3,
    firstAt: 6, // s after the scene mounts before anyone may appear
    checkEvery: 1.0, // s between spawn checks (the timer)
    quietMin: 10, // s the portal sits empty between outings...
    quietMax: 24, // ...drawn at random between these
    outingWeights: { one: 65, two: 30, three: 5 }, // relative odds of an outing's size
    joinGapMin: 5, // s after a spawn before a companion may join...
    joinGapMax: 12,
    joinChance: 0.35, // ...and then this chance per check
    thirdExtraGap: 6, // s more than the join gap before a third may join
    letterCooldown: 20, // s before the same letter can be serviced again
    letterGap: 1, // letters kept clear either side of one being worked on
    vanishRest: 5, // s of quiet after a vanish (the word left)
  },

  /** The gate, in the gate's own space (from the model). Heights under the
      feet come from raycasting the model; these place the routes. */
  gate: {
    hover: 0.78, // where they materialise: feet, mid-opening
    plinthTop: 0.365,
    plinthEdge: 0.268, // the plinth's front edge
    stepTop: 0.166, // the ground slab's top
    stepEdge: 0.33, // ...and its front edge
    floorAt: 0.5, // where the floor proper begins
    halfWidth: 0.9, // how wide the plinth is
    zone: 1.0, // z inside which only one portlet may be
  },

  /** Round the word, in the word's own space: how far past its end they
      turn, how far behind and in front of the row they walk. */
  lanes: { pastEnd: 0.55, behind: -0.6, front: 0.6 },

  /** Walking: a steering model, desired velocity -> capped acceleration ->
      velocity -> position. */
  locomotion: {
    maxSpeed: 1.35,
    accel: 2.2, // speeding up
    decel: 3.2, // slowing down
    stopRadius: 0.03, // arrived when this close and slow
    lookahead: 0.26, // how far ahead along the path they aim
    cornerSlow: 0.6, // 0..1 how much a tight bend slows them (they arc, not stop)
    sepRadius: 0.42, // keep this far from each other...
    sepStrength: 1.6, // ...pushed apart this hard (velocity per unit)
    followSlow: 0.75, // speed factor when someone is right ahead
  },

  /** Turning: facing is its own thing, with its own speed limit. Anything
      under `turnInPlace` is resolved as a moving arc; only near-reversals
      are made on the spot, and those are stepped, not spun. */
  turning: {
    maxAngVel: deg(110), // per second
    gain: 4.5, // how eagerly the heading chases (rad/s per rad of error)
    damping: 12, // how fast angular velocity settles
    angDecel: deg(260), // per s^2: the turn eases out into the heading
    ramp: 0.4, // s the turn on the spot eases in over
    turnInPlace: deg(150), // only a turn bigger than this is made standing still...
    resume: deg(30), // ...until the error is under this
    shuffleStep: deg(36), // degrees of turn per foot shuffle
    shuffleSwing: 0.32, // how far the feet shuffle
    weightShift: 0.045, // body roll into each shuffle
    torsoLead: 0.2, // torso yaw ahead of the hips at full turn rate
    headLead: 0.8, // the head looks toward the new heading, up to this
    bank: deg(4.5), // roll at full angular velocity while moving
    bankSpring: 12, // stiffness of the spring back to level
  },

  /** The walk cycle, tied to ground speed so feet never skate. */
  gait: {
    stride: 0.4, // world units per full cycle
    legSwing: 0.7,
    armSwing: 0.5,
    lean: 0.13, // forward body pitch at full speed
    sway: 0.05, // body yaw with the stride
    bob: 0.028, // rise per step
  },

  /** The ground under the feet: raycast against the gate's steps at each
      foot and toe, the body following the highest with a spring, so they
      step UP onto each stair and drop off edges. */
  ground: {
    footSpread: 0.055, // feet either side of the centre
    toe: 0.05, // ahead of each foot
    toeLookahead: 0.12, // s of travel looked ahead so the rise starts as the foot reaches the edge
    stairSpeed: 0.55, // they slow to this on and just before the steps
    riseOmega: 24, // spring bringing the body up a riser (settles in ~0.2 s, the time the foot takes to cross)
    stepMin: 0.05, // a rise this big is a step (leg lift, timed to the rise)
    climbTime: 0.3, // s the step-up animation takes, matched to the rise
    climbLift: 0.95, // rad the leading leg lifts
    dropMin: 0.035, // a fall this big is a drop (ballistic)
  },

  /** The body's ride height: a critically damped spring, with idle noise. */
  hover: {
    omega: 17, // spring stiffness (rad/s); higher = firmer
    bobAmp: 0.008,
    bobHz: 0.65,
    jitterAmp: 0.0022,
    jitterHz: [5.1, 8.3] as [number, number],
    accelDip: 0.03, // dip at full acceleration
    decelRise: 0.03, // rise at full deceleration
    shuffleBob: 0.006, // dip per shuffle step while turning on the spot
    recoil: 0.32, // upward kick (velocity) on a hammer blow
    gravity: 5.5, // for drops off the steps
    landSquash: 0.55, // fraction of landing speed put into the squash
  },

  /** Blending between states and poses. */
  blend: {
    state: 0.26, // s crossfade whenever the state changes
    pose: 13, // exponential smoothing of the pose (1/s)
    toolDraw: 0.3, // s for the tool to appear in the hand
    toolStow: 0.25,
  },

  /** Reaching the work: where they stand, how far the body may lean in. */
  reach: {
    bodyClearance: 0.19, // body centre to the letter's front plane
    stretch: 0.045, // ride-height rise allowed to reach up
    squat: 0.06, // ride-height drop allowed to reach down
    maxNudge: 0.055, // how far the body may lean into a stroke
    nudgeOmega: 11,
    reachTolerance: 0.02, // slack accepted in the arm's length
    minStance: 0.16, // never nearer the letter's front plane than this
    maxStance: 0.38,
    wallChance: 0.4, // chance a job picks a side wall when the tool allows
    maxTorsoPitch: 0.28, // hard cap on bending forward (a reach is arm, not spine)
    maxHeadPitch: 0.5, // hard cap on looking down (the face stays out of the can)
  },

  /** Contact sampling (contact.ts), in the letter's own space. */
  contact: {
    gridX: 9,
    gridY: 13,
    ringRadii: [0.015, 0.03, 0.05, 0.075], // flatness tested at these radii
    ringSamples: 6,
    walls: true,
    wallDirs: 8,
    maxClear: 0.45,
  },

  /** The ceremony around a job. */
  ceremony: {
    fade: 0.35, // materialising, dissolving
    drop: 0.42, // from mid-opening onto the plinth
    anticipation: 0.35, // tool drawn back before the first stroke
    followThrough: 0.45, // eased off after the last
    stepBack: 0.22, // how far they step back to inspect
    inspectMin: 1.2,
    inspectMax: 1.9,
    waitLook: 1.8, // s per look-around while waiting for the gate
  },

  /** The jobs. Durations in seconds, distances in world units. */
  actions: {
    hammer: {
      strikesMin: 5,
      strikesMax: 8,
      gapMin: 0.32, // between blows (randomised, not a metronome)
      gapMax: 0.72,
      windUp: 0.22, // pulling back
      pullBack: 0.07, // how far the head comes off the nail
      pullArc: deg(38), // how far the hammer tilts back about the grip
      strike: 0.09, // the blow itself
      recoilDist: 0.018, // bounce off the nail
      recoilTime: 0.12,
      nailLen: 0.058,
      nailStart: 0.8, // fraction of the nail showing at the start
      nailEnd: 0.08, // ...and once driven home
      bodyRecoil: 0.32,
    },
    polish: {
      spots: 2,
      perSpotMin: 3.0,
      perSpotMax: 4.2,
      radius: 0.038, // half-width of the figure-eight
      hz: 1.05,
      spin: 20, // rad/s the pad turns
      pressure: 0.004, // pad squash into the surface
      shineFade: 1.4,
    },
    paint: {
      rows: 4,
      rowSpacing: 0.042,
      rowHalf: 0.052, // half-length of a row stroke
      stroke: 0.95, // s per row
      lift: 0.03, // brush lifts this far between rows
      reloadEvery: 2, // rows between trips to the can
      reloadDips: 2,
      /* The can is a reach target, not a work surface: it stands to the
         portlet's right at its own standoff, tall enough that the dip is
         mostly arm. */
      canOffset: 0.155, // to the right of the stance
      canForward: 0.03,
      canHeight: 0.115, // the tin's rim
      dipDepth: 0.012, // how far the bristle tips go under the paint
      reach: 0.6, // s: turn to the can and bring the brush over it
      dip: 0.45, // s down into the paint
      hold: 0.12, // s in the paint
      liftOut: 0.38, // s back out
      out: 0.65, // s: turn back and carry the brush to the next row
      squat: 0.05, // ride-height dip while reaching down
      hoverAbove: 0.06, // the brush hovers this far over the paint between dips
    },
    weld: {
      seamHalf: 0.045,
      timeMin: 3.0,
      timeMax: 4.2,
      gap: 0.011, // the arc gap: tip held this far off the surface
      wobble: 0.004,
      sparkRate: 55, // per second while the arc is on
      sparkLife: 0.38,
      sparkSpeed: 0.55,
    },
    wrench: {
      turnsMin: 4,
      turnsMax: 6,
      drive: 0.55, // s per tightening stroke
      back: 0.36, // s to lift and turn back for the next
      angle: deg(75),
      lift: 0.02, // the socket lifts off the bolt to turn back
      headH: 0.018, // bolt head height (fits inside the socket)
      sinkPerTurn: 0.0018,
    },
    vacuum: {
      timeMin: 3.2,
      timeMax: 4.6,
      sweep: 0.05, // half-width of the sweep
      hz: 0.62,
      gap: 0.008,
      rumble: 0.0015,
      dust: 48,
      pull: 2.2, // how fast dust is drawn in (1/s)
    },
  },

  /** Verification aids. `contacts` draws every usable contact on the letter
      being worked on and the tool's tip; `penetration` raycasts the tool's
      probes every frame and counts any inside a letter (stats.penetrations).
      Both live in the layout panel too. */
  debug: {
    contacts: false,
    penetration: true,
  },
};

export type PortletConfig = typeof PORTLET_CONFIG;
export type ActionKind = keyof typeof PORTLET_CONFIG.actions;
export const ACTION_KINDS = Object.keys(PORTLET_CONFIG.actions) as ActionKind[];
