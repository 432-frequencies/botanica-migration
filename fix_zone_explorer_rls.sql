-- Migration: Ajouter policy RLS pour exploration publique des zones
-- À exécuter dans: Supabase Dashboard > SQL Editor
-- Date: 2026-04-08
-- Raison: ZoneExplorer doit afficher les découvertes de tous les utilisateurs dans une zone géographique

-- Ajouter policy de lecture publique pour discoveries (privacy-preserving: données de biodiversité seulement)
CREATE POLICY "discoveries are publicly readable for zone exploration"
  ON plant_discoveries FOR SELECT
  USING (true);

-- Note: La policy existante "users can read own discoveries" reste active
-- Les deux policies sont combinées avec OR, donc l'utilisateur peut voir:
-- 1. Ses propres découvertes (policy existante)
-- 2. Les découvertes des autres pour exploration de zone (nouvelle policy)
