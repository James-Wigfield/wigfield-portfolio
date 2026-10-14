import { Component } from 'react';

/* ============================================================================
   SEMINAR DECKS — PHONE REMOTE: error boundary
   ----------------------------------------------------------------------------
   Every piece of the remote's UI sits inside one of these. If remote code
   throws while rendering, the boundary renders `fallback` (nothing by default)
   and calls `onError`, and the page around it (the phone script, present mode,
   the presenter view, the deck page) carries on exactly as it would with no
   remote at all.
   ========================================================================== */

export default class RemoteBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    try {
      console.info('[deck-remote] remote stopped after an error:', error?.message ?? error);
      this.props.onError?.(error);
    } catch {
      /* the fallback is already showing */
    }
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}
