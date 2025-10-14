import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Removed unused manual password hashing and uuid generation

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name } = await request.json();
    
    console.log('Manual signup attempt for:', email);
    
    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: { message: 'Server configuration error' } },
        { status: 500 }
      );
    }

    // Create service client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: { message: 'User already exists' } },
        { status: 400 }
      );
    }

    // Create auth user using Supabase Admin API
    const { data: createdUserData, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      // Désactiver la confirmation par email si SMTP n'est pas configuré
      email_confirm: false,
      user_metadata: { full_name: full_name || email.split('@')[0] }
    });

    if (createUserError || !createdUserData?.user) {
      console.error('Failed to create auth user:', createUserError);
      return NextResponse.json(
        { error: { 
          message: 'Failed to create auth user',
          details: (createUserError as any)?.message ?? null,
          status: (createUserError as any)?.status ?? null,
          code: (createUserError as any)?.code ?? null,
        } },
        { status: 500 }
      );
    }

    const userId = createdUserData.user.id;

    // Ensure user profile exists (a DB trigger may already create it)
    // 1) Try to read existing profile
    const { data: existingProfile, error: readProfileError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle?.() ?? { data: null, error: null } as any;

    let userData = existingProfile;

    // 2) If missing, upsert a minimal profile
    if (!userData) {
      const { data: insertedProfile, error: upsertError } = await supabase
        .from('users')
        .upsert({
          user_id: userId,
          email: email,
          username: email.split('@')[0],
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        console.error('Failed to create user profile:', upsertError);
        return NextResponse.json(
          { error: { message: 'Failed to create user profile' } },
          { status: 500 }
        );
      }

      userData = insertedProfile;
    }

    console.log('User created successfully:', userData);

    // Return success response
    return NextResponse.json({
      data: {
        user: {
          id: userId,
          email: email,
          email_confirmed_at: createdUserData.user.email_confirmed_at ?? new Date().toISOString(),
          user_metadata: createdUserData.user.user_metadata,
          identities: createdUserData.user.identities ?? []
        }
      },
      error: null
    });
    
  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}