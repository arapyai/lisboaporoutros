import { Component, type ReactNode } from 'react';

/** A failed code download is recoverable, not a blank administrative page. */
export class AdminLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="content-panel" role="alert">
      <h2>Não foi possível abrir o administrativo.</h2>
      <p>Verifique a conexão e tente carregar novamente.</p>
      <button type="button" onClick={() => window.location.reload()}>Tentar novamente</button>
    </main>;
    return this.props.children;
  }
}
