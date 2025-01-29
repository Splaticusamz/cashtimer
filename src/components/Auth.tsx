import { useState } from 'react';
import { Button, TextInput, Stack, Text, Container } from '@mantine/core';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" px={20} py={60}>
      <form onSubmit={handleSubmit}>
        <Stack spacing={20}>
          <Text size="xl" weight={700} align="center">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </Text>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" loading={loading}>
            {mode === 'login' ? 'Sign In' : 'Sign Up'}
          </Button>
          <Button 
            variant="subtle" 
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </Button>
        </Stack>
      </form>
    </Container>
  );
} 