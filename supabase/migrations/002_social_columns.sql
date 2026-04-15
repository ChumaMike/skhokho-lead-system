-- supabase/migrations/002_social_columns.sql
-- Add optional social media profile columns to activation_leads

alter table activation_leads
  add column if not exists facebook_page_url text,
  add column if not exists instagram_url text;
