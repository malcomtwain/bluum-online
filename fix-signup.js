// Script Node.js pour tester et corriger le signup
// Run: node fix-signup.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wjtguiusxvxaabutfxls.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdGd1aXVzeHZ4YWFidXRmeGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNTkxMDksImV4cCI6MjA2ODkzNTEwOX0.4sIdI3m2QF_KP3EdmSR7N92pnET4ApLt_FNpuoR-234';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignup() {
  try {
    console.log('Testing signup with API...');
    
    const { data, error } = await supabase.auth.signUp({
      email: 'testuser@example.com',
      password: 'TestPassword123',
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    });
    
    if (error) {
      console.error('Signup failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Signup successful!');
      console.log('User:', data.user?.email);
      console.log('Session:', !!data.session);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testSignup();