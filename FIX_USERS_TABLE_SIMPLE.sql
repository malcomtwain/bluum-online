-- CRÉER LA TABLE USERS SI ELLE N'EXISTE PAS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT,
    invitation_code TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- CRÉER LES INDEX
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- ACTIVER RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- CRÉER LA FONCTION ensure_default_collections
CREATE OR REPLACE FUNCTION public.ensure_default_collections(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CRÉER LA FONCTION handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, email, username)
    VALUES (
        new.id, 
        new.email,
        split_part(new.email, '@', 1)
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        updated_at = now();
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CRÉER LE TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MIGRER LES UTILISATEURS EXISTANTS
INSERT INTO public.users (user_id, email, username)
SELECT 
    id, 
    email,
    split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
SET 
    email = EXCLUDED.email,
    updated_at = now();

-- CRÉER LES POLITIQUES RLS
DROP POLICY IF EXISTS "Users can view any profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

CREATE POLICY "Users can view any profile" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- VÉRIFIER
SELECT COUNT(*) as total_users FROM public.users;