-- supabase/migrations/002_social_columns.sql
-- Add optional social media profile columns to activation_leads

alter table activation_leads
  add column if not exists facebook_page_url text,
  add column if not exists instagram_url text;

-- Store Meta's wamid so we can match delivery/read status webhooks
alter table activation_messages
  add column if not exists meta_message_id text;

create index if not exists activation_messages_meta_id_idx
  on activation_messages(meta_message_id)
  where meta_message_id is not null;
