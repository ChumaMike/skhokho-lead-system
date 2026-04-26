#!/usr/bin/env node
// Run with: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/migrate-email.js
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var')
  console.error('Get one at: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const sql = `
-- 1. Add email + email_status to activation_leads
alter table activation_leads add column if not exists email text;
alter table activation_leads add column if not exists email_status text
  check (email_status is null or email_status in ('valid', 'bounced', 'unsubscribed'));

-- 2. Add subject to activation_messages
alter table activation_messages add column if not exists subject text;

-- 3. Rename meta_message_id -> provider_message_id (only if not already done)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'activation_messages' and column_name = 'meta_message_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_name = 'activation_messages' and column_name = 'provider_message_id'
  ) then
    alter table activation_messages rename column meta_message_id to provider_message_id;
  end if;
end $$;

-- 4. Add provider_message_id if it never existed (defensive — skipped if rename ran)
alter table activation_messages add column if not exists provider_message_id text;

-- 5. Extend status enum to include 'read' (existing whatsapp-webhook writes this and would otherwise violate)
alter table activation_messages drop constraint if exists activation_messages_status_check;
alter table activation_messages add constraint activation_messages_status_check
  check (status in ('scheduled', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

-- 6. email_events table
create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references activation_messages(id) on delete cascade,
  event_type text not null check (event_type in ('delivered', 'opened', 'clicked', 'bounced', 'complained')),
  created_at timestamptz not null default now(),
  payload jsonb
);
create index if not exists email_events_message_id_idx on email_events(message_id, event_type);
`

fetch('https://api.supabase.com/v1/projects/fxnbghdnajcldnnkjewc/database/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ query: sql }),
})
  .then((r) => r.json())
  .then((data) => {
    if (data.error) {
      console.error('Migration failed:', data.error)
      process.exit(1)
    }
    console.log('✓ email/email_status columns added')
    console.log('✓ subject column added')
    console.log('✓ meta_message_id renamed to provider_message_id')
    console.log('✓ status enum extended (read)')
    console.log('✓ email_events table created')
    console.log('\nMigration complete.')
  })
  .catch((err) => {
    console.error('Request failed:', err.message)
    process.exit(1)
  })
