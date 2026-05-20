import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Coins } from 'lucide-react';
import { login } from '../api/client';

export default function Login({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);
    setShake(false);

    try {
      const res = await login(password);
      if (res.success) {
        onLoginSuccess();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.response?.data?.error ?? 'Invalid password. Please try again.');
      setShake(true);
      // Reset shake animation class after it completes
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-header">
          <div className="login-logo-container">
            <Coins className="login-logo-icon" size={32} />
          </div>
          <h1 className="login-title">WheresMyMoney!</h1>
          <p className="login-subtitle">Enter your password to unlock your financial dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <div className="input-icon-wrapper">
              <Lock className="input-left-icon" size={16} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              disabled={loading}
              autoFocus
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={14} className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading || !password.trim()}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              'Unlock Dashboard'
            )}
          </button>
        </form>

        <div className="login-footer">
          Self-hosted financial tracking aggregation
        </div>
      </div>
    </div>
  );
}
