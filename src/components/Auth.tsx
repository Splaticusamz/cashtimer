import { useState } from 'react';
import '../styles/Auth.css';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onAuth: () => void;
}

// Add auth states type
type AuthState = 'login' | 'signup' | 'check-email' | 'verify';

export function Auth({ onAuth }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>('login');

  // Add email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Update handleAuth
  const handleAuth = async () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);
    
    if (authState === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        onAuth();
      }
    } else if (authState === 'signup') {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { email }
        }
      });
      
      if (error) {
        console.error('Signup error:', error);
        setError(error.message);
        return;
      }

      if (!data.user) {
        setError('Something went wrong. Please try again.');
        return;
      }

      if (data.user.identities?.length === 0) {
        setError('This email is already registered. Please login instead.');
        return;
      }

      console.log('Signup successful:', data.user);
      setAuthState('check-email');
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-header">
        <h1 className="auth-title">CashTimer</h1>
        <p className="auth-tagline">Watch your motivation grow by the second</p>
      </div>
      <div className="auth-container">
        {authState === 'check-email' ? (
          <div className="auth-message">
            <h2>Check your email</h2>
            <p>We've sent you a verification link to {email}</p>
            <button 
              className="auth-button"
              onClick={() => setAuthState('login')}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={`auth-tab ${authState === 'login' ? 'active' : ''}`}
                onClick={() => setAuthState('login')}
              >
                Login
              </button>
              <button
                className={`auth-tab ${authState === 'signup' ? 'active' : ''}`}
                onClick={() => setAuthState('signup')}
              >
                Sign Up
              </button>
            </div>
            
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              required
            />
            
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              minLength={6}
              required
            />

            {error && (
              <p className="auth-error">{error}</p>
            )}

            <button 
              className="auth-button"
              onClick={handleAuth}
              disabled={loading}
            >
              {authState === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </>
        )}
      </div>
    </div>
  );
} 