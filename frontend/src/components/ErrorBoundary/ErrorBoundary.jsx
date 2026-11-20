import React, { Component } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || 'An unexpected application error occurred.';

      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-wrapper">
              <AlertTriangle className="error-boundary-icon" size={32} />
            </div>

            <h2 className="error-boundary-title">Something went wrong</h2>
            <p className="error-boundary-description">
              A view rendering error was caught. Your project data is completely safe.
            </p>

            <div className="error-boundary-message-box">
              <span className="error-boundary-error-text">{errorMessage}</span>
            </div>

            <div className="error-boundary-actions">
              <button
                type="button"
                className="error-boundary-btn primary"
                onClick={this.handleReset}
              >
                <RotateCcw size={16} /> Try Again
              </button>
              <button
                type="button"
                className="error-boundary-btn secondary"
                onClick={this.handleReload}
              >
                Reload Page
              </button>
              <button
                type="button"
                className="error-boundary-btn text"
                onClick={this.handleGoHome}
              >
                <Home size={16} /> Return to Overview
              </button>
            </div>

            {this.state.errorInfo && (
              <div className="error-boundary-details">
                <button
                  type="button"
                  className="error-boundary-toggle-details"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                >
                  {this.state.showDetails ? 'Hide Technical Details' : 'Show Technical Details'}
                </button>

                {this.state.showDetails && (
                  <pre className="error-boundary-stack">
                    {this.state.error?.stack}
                    {'\n\nComponent Stack:'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
