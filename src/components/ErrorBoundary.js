import React from 'react';
import { showError } from '../utils/toast';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Váratlan hiba:', error, errorInfo);
    showError('Váratlan hiba történt az alkalmazásban. Kérjük, töltse újra az oldalt.');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h2>Valami hiba történt</h2>
          <p>Kérjük, töltse újra az oldalt, vagy lépjen vissza a főoldalra.</p>
          <button
            onClick={() => window.location.href = '/'}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}
          >
            Vissza a főoldalra
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
