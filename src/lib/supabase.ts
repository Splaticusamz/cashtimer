import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nrkrypwvcffrjfuzihlo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ya3J5cHd2Y2ZmcmpmdXppaGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNzYxNjEsImV4cCI6MjA1Mzc1MjE2MX0.5KkOV-hoYbaAEBNCNjRfqazb69zEa7CJyIQgAmoHkg8';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Add this function to sign in anonymously
export const signInAnonymously = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'sam@samzamor.com',
    password: 'cash123'
  });
  
  if (error) {
    console.error('Error signing in:', error);
    return null;
  }
  
  return data.user;
}; 