-- Script pour mettre le compte test@test.com en mode Pro
-- Cela permettra de faire des tests illimités sans la limite de 5 scans par jour

UPDATE user_profiles 
SET is_pro = true
WHERE user_email = 'test@test.com';

-- Optionnel : Réinitialiser le compteur quotidien pour commencer frais
UPDATE user_profiles 
SET daily_identifications_count = 0
WHERE user_email = 'test@test.com';

-- Vérifier le résultat
SELECT user_email, is_pro, daily_identifications_count, total_points, total_plants
FROM user_profiles
WHERE user_email = 'test@test.com';
