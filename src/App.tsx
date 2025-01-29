import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MantineProvider, Container, Box } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Timer } from './components/Timer';
import { Auth } from './components/Auth';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

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
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        colorScheme: 'dark',
        primaryColor: 'teal',
        fontFamily: 'Inter, sans-serif',
        headings: { fontFamily: 'Inter, sans-serif' },
        components: {
          Button: {
            styles: {
              root: { 
                fontWeight: 600,
                borderRadius: '12px',
                fontSize: '1rem'
              }
            }
          },
          Paper: {
            styles: {
              root: {
                borderRadius: '16px',
                backgroundColor: '#1A1B1E'
              }
            }
          }
        }
      }}
    >
      <ModalsProvider>
        <Box 
          sx={{ 
            minHeight: '100vh', 
            backgroundColor: '#141517'
          }}
        >
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
            </Routes>
          </BrowserRouter>
        </Box>
      </ModalsProvider>
    </MantineProvider>
  );
}

export default App;
