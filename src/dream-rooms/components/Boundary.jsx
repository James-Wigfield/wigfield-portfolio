/* An error boundary: a broken page (or a broken stage) shows a quiet line, never the whole app
   gone. Logs the error's name only (a message could, in theory, carry words). */

import { Component } from 'react';
import { COPY } from '../copy.js';

export default class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err) {
    console.error('[dream-rooms] page error', err?.name || 'Error');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <main className="dr-page dr-quiet" data-dr="boundary">
        <p className="dr-line">{COPY.app.boundary}</p>
        <button type="button" className="dr-link" onClick={() => window.location.reload()}>
          {COPY.app.reload}
        </button>
      </main>
    );
  }
}
