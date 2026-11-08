/* Keeps one page's crash (or a chunk that fails to load offline) from blanking the
   whole app: the header and outbox stay, with a quiet message and Reload. */

import { Component } from 'react';
import { COPY } from '../copy.js';

export default class PageBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[memory-rooms] page error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mr-state" role="alert">
        <p className="mr-state-title">{COPY.app.pageError}</p>
        <button type="button" className="mr-btn" onClick={() => window.location.reload()}>
          {COPY.app.reload}
        </button>
      </div>
    );
  }
}
