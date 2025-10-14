-- Script pour ajouter une clé API PostFast

-- D'abord, créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.postfast_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  api_key TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter une clé API pour L'UTILISATEUR CONNECTÉ
-- NE PAS METTRE D'ID EN DUR !
INSERT INTO public.postfast_api_keys (user_id, name, api_key, is_active, is_default)
VALUES (
  auth.uid(),  -- Utilise automatiquement votre UUID d'utilisateur connecté
  'Ma clé API PostFast',
  'YOUR_POSTFAST_API_KEY_HERE', -- Remplacez par votre vraie clé API PostFast
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Vérifier que la clé a été ajoutée
SELECT * FROM public.postfast_api_keys;