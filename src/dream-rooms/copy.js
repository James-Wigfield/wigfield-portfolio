/* Every word of Dream Rooms' own UI, in one place (his dreams are never in here).
   Quiet, lower case, no exclamation marks, no emoji. */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const COPY = {
  app: {
    name: 'Dreams',
    newTitle: 'New dream',
    boundary: 'Something went wrong on this page.',
    reload: 'reload',
  },

  gate: {
    label: 'dreams',
    password: 'password',
    submit: 'open',
    checking: 'checking',
    wrong: 'not that one',
    offline: 'no signal · try again when there is',
    closed: 'dreams are not set up on this server yet',
    error: 'could not check it · try again',
    expired: 'the password changed · enter it again',
  },

  /** A row's status, as its dot's label. */
  status: {
    captured: 'waiting to be read',
    reading: 'being read',
    building: 'being built',
    rendered: 'rendered',
    failed: "didn't build",
  },

  night: {
    of: (label) => `Night of ${label}`,
    dream: (n) => `dream ${n}`,
    count: (n) => plural(n, 'dream', 'dreams'),
  },

  capture: {
    hint: 'Tap, then the mic on your keyboard. Just talk.',
    textLabel: 'the dream',
    changeNight: 'change the night',
    save: 'Save dream',
    saving: 'Saving',
    autosave: {
      idle: '',
      saving: 'keeping',
      saved: 'kept on this phone',
      volatile: 'not kept if this tab closes',
    },
    saved: {
      title: 'Saved.',
      another: 'Another dream from the same night',
      corridor: 'corridor',
      list: 'list',
    },
    upload: {
      waiting: 'on this phone · goes up when there is signal',
      uploading: 'going up',
      uploaded: 'uploaded',
      error: 'could not upload · kept on this phone',
      retry: 'try again',
      blocked: 'waiting for the password',
    },
    others: (n) => `${plural(n, 'other dream', 'other dreams')} on this phone, waiting for signal`,
  },

  corridor: {
    newDream: 'new dream',
    list: 'list',
    loading: '',
    error: 'the corridor could not load',
    retry: 'try again',
  },

  list: {
    title: 'dreams',
    corridor: 'corridor',
    newDream: 'new dream',
    walkAnyway: 'walk the corridor anyway',
    reducedMotion: 'reduced motion is on, so here is the list',
    noWebgl: 'this browser cannot draw the corridor, so here is the list',
    empty: 'nothing dreamt yet',
    loading: 'loading',
    error: 'the list could not load',
    retry: 'try again',
    walk: 'walk',
    up: 'earlier in the night',
    down: 'later in the night',
    moveError: 'that move did not stick · the list is reloaded',
    untitled: 'untitled',
    waiting: (n) => `${plural(n, 'dream', 'dreams')} on this phone, waiting for signal`,
  },

  dream: {
    corridor: 'corridor',
    list: 'list',
    loading: 'loading',
    missing: 'no dream here',
    error: 'this dream could not load',
    retry: 'try again',
    yourWords: 'as told',
    edit: 'edit',
    saveEdit: 'save the change',
    savingEdit: 'saving',
    editSaved: 'saved',
    editConflict: 'it changed somewhere else, so it was reloaded · save again to keep yours',
    editFrozen: 'it is being read now, so that change could not go in',
    editError: 'could not save · try again',
    splitNote: 'part of this capture became its own dream',
    splitFrom: 'split out of a longer capture',
    splitOpen: 'open',
    rememberedLater: 'remembered later',
    rememberMore: 'Remembered more',
    rememberHint: 'anything that came back later',
    rememberSave: 'add it',
    rememberSaving: 'adding',
    rememberSaved: 'added · the next read takes it in',
    reason: 'why',
    enter: 'Enter',
    enterHint: 'sound on',
    nothingToWalk: 'the still is all there is of this one yet',
    noDraft: 'there is no draft build of this dream',
    draftLabel: 'draft build',
    stageError: 'the dream could not open',
  },

  still: {
    tapForSound: 'tap for sound',
    back: 'back to the corridor',
  },
};

/** The status dot's label, safe for unknown values. */
export const statusLabel = (status) => COPY.status[status] || status || '';
