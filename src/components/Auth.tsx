import React, { useState } from 'react';
import { Paper, TextInput, PasswordInput, Button, Stack, Text, Group, Tabs } from '@mantine/core';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onAuth: () => void;
}

export function Auth({ onAuth }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    
    const { error } = activeTab === 'login' 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      onAuth();
    }
    
    setLoading(false);
  };

  return (
    <Paper 
      p={40} 
      style={{ 
        maxWidth: 400, 
        margin: '100px auto',
        background: '#1A1B1E',
        border: '1px solid #2C2E33'
      }}
    >
      <Stack spacing="lg">
        <Text 
          size="xl" 
          weight={700} 
          align="center"
          style={{ 
            color: '#00b5a9',
            marginBottom: 20 
          }}
        >
          CashTimer
        </Text>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value as 'login' | 'signup')}>
          <Tabs.List grow>
            <Tabs.Tab value="login">Login</Tabs.Tab>
            <Tabs.Tab value="signup">Sign Up</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        
        <TextInput
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
        
        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        {error && (
          <Text color="red" size="sm">
            {error}
          </Text>
        )}

        <Button 
          onClick={handleAuth}
          loading={loading}
          style={{
            background: 'linear-gradient(135deg, #00e6d4 0%, #00b5a9 100%)',
            marginTop: 20
          }}
        >
          {activeTab === 'login' ? 'Login' : 'Sign Up'}
        </Button>
      </Stack>
    </Paper>
  );
} 