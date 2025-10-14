#!/bin/bash

# Post-bridge Migration Script
# This script helps migrate from PostFast API to Post-bridge API

echo "🚀 Starting migration from PostFast to Post-bridge API..."

# Step 1: Run database migration
echo "📄 Step 1: Running database migration..."
npx supabase db push --file supabase/migrations/migrate_to_post_bridge.sql

if [ $? -ne 0 ]; then
    echo "❌ Database migration failed. Please check the error above."
    exit 1
fi

echo "✅ Database migration completed successfully!"

# Step 2: Instructions for manual steps
echo ""
echo "📝 Step 2: Manual steps required:"
echo "1. Find your user ID by running this query in Supabase:"
echo "   SELECT id FROM auth.users WHERE email = 'your_email@example.com';"
echo ""
echo "2. Insert your Post-bridge API key by editing INSERT_POST_BRIDGE_API_KEY.sql"
echo "   Replace 'YOUR_USER_ID_HERE' with your actual user ID from step 1"
echo ""
echo "3. Run the modified SQL in your Supabase dashboard"

# Step 3: Restart dev server
echo ""
echo "🔄 Step 3: Restarting development server..."
echo "Please restart your npm run dev to see the changes"

echo ""
echo "🎉 Migration preparation completed!"
echo ""
echo "⚠️  Important notes:"
echo "- Your Post-bridge API key: pb_live_6wCwS8ojvWbVt92qtthRPW"
echo "- Make sure to complete the manual steps above"
echo "- The app now uses /api/post-bridge/* endpoints instead of /api/postfast/*"
echo "- Social account IDs are now numbers instead of strings"
echo ""
echo "🔗 Post-bridge API Documentation: https://api.post-bridge.com/docs"