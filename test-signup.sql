-- Désactiver temporairement le trigger pour tester
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Pour réactiver plus tard :
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();