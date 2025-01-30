import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Add immediate check for hash params
    const checkHash = async () => {
      const hash = window.location.hash;
      console.log('Current hash:', hash); // Debug

      // If we have a token in the URL, try to verify it directly
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('Session error:', error);
            setError('Error setting session. Please try logging in again.');
          } else {
            navigate('/');
            return;
          }
        }
      }

      // Check for error in URL
      if (hash.includes('error=')) {
        const params = new URLSearchParams(hash.substring(1));
        const error = params.get('error_description');
        setError(error?.replace(/\+/g, ' ') || 'Verification failed');
      }
    };

    checkHash();

    const handleAuthChange = async (event: string, session: Session | null) => {
      console.log('Auth event:', event, session); // Debug

      if (event === 'SIGNED_IN' && session) {
        navigate('/');
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Add timeout to show error if verification takes too long
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!error) {
        setError('Verification is taking longer than expected. Please try logging in directly.');
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [error]);

  return (
    <div className="auth-wrapper">
      <div className="auth-message">
        {error ? (
          <>
            <h2>Verification Status</h2>
            <p>{error}</p>
            <button 
              className="auth-button"
              onClick={() => navigate('/login')}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <h2>Verifying...</h2>
            <p>Please wait while we verify your email.</p>
            <div className="loading-spinner"></div>
          </>
        )}
      </div>
    </div>
  );
} 