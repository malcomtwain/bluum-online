// Script to setup Post-bridge API in Supabase
// Run this with: node setup_post_bridge.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wjtguiusxvxaabutfxls.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqdGd1aXVzeHZ4YWFidXRmeGxzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM1OTEwOSwiZXhwIjoyMDY4OTM1MTA5fQ.0RfjIhx_NwNgAzVQvmJWOS0n64JCm_mKHApSRmn1h-Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupPostBridge() {
  console.log('🚀 Setting up Post-bridge API...');

  try {
    // Step 1: Create the table
    console.log('📄 Creating post_bridge_api_keys table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS post_bridge_api_keys (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          api_key TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_post_bridge_api_keys_user_id ON post_bridge_api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_post_bridge_api_keys_active ON post_bridge_api_keys(user_id, is_active);
      
      ALTER TABLE post_bridge_api_keys ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can manage their own Post-bridge API keys" ON post_bridge_api_keys;
      CREATE POLICY "Users can manage their own Post-bridge API keys" 
      ON post_bridge_api_keys FOR ALL 
      USING (auth.uid() = user_id) 
      WITH CHECK (auth.uid() = user_id);
      
      GRANT ALL ON post_bridge_api_keys TO authenticated;
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (tableError) {
      console.error('Error creating table:', tableError);
    } else {
      console.log('✅ Table created successfully!');
    }

    // Step 2: Add columns to scheduled_posts
    console.log('📄 Adding columns to scheduled_posts...');
    
    const addColumnsSQL = `
      ALTER TABLE scheduled_posts 
      ADD COLUMN IF NOT EXISTS post_bridge_post_id TEXT,
      ADD COLUMN IF NOT EXISTS media_ids TEXT[] DEFAULT '{}';
    `;

    const { error: columnsError } = await supabase.rpc('exec_sql', { sql: addColumnsSQL });
    if (columnsError) {
      console.error('Error adding columns:', columnsError);
    } else {
      console.log('✅ Columns added successfully!');
    }

    // Step 3: Get first user and insert API key
    console.log('👤 Finding user and inserting API key...');
    
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(1);

    if (usersError) {
      console.error('Error getting users:', usersError);
      console.log('⚠️  Please manually insert your API key:');
      console.log('INSERT INTO post_bridge_api_keys (user_id, api_key) VALUES (\'YOUR_USER_ID\', \'pb_live_6wCwS8ojvWbVt92qtthRPW\');');
      return;
    }

    if (users && users.length > 0) {
      const userId = users[0].id;
      console.log(`📧 Found user: ${users[0].email} (${userId})`);
      
      const { error: insertError } = await supabase
        .from('post_bridge_api_keys')
        .upsert({
          user_id: userId,
          api_key: 'pb_live_6wCwS8ojvWbVt92qtthRPW',
          is_active: true
        });

      if (insertError) {
        console.error('Error inserting API key:', insertError);
      } else {
        console.log('✅ Post-bridge API key inserted successfully!');
      }
    }

    // Step 4: Verify setup
    console.log('🔍 Verifying setup...');
    
    const { data: apiKeys, error: verifyError } = await supabase
      .from('post_bridge_api_keys')
      .select('*');

    if (verifyError) {
      console.error('Error verifying setup:', verifyError);
    } else {
      console.log('✅ Verification successful!');
      console.log('📊 API Keys found:', apiKeys.length);
      apiKeys.forEach(key => {
        console.log(`   - User: ${key.user_id}, Active: ${key.is_active}`);
      });
    }

    console.log('\n🎉 Post-bridge setup completed successfully!');
    console.log('🔑 Your API key: pb_live_6wCwS8ojvWbVt92qtthRPW');
    console.log('📚 Documentation: https://api.post-bridge.com/docs');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupPostBridge();