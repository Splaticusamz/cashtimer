import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/App.css';
import { Timer } from './components/Timer';
import { Auth } from './components/Auth';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { AuthCallback } from './pages/AuthCallback';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return null; // or loading spinner
  }

  return (
    <div className="app">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={
              !isAuthenticated ? (
                <Auth onAuth={() => setIsAuthenticated(true)} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <Timer />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
