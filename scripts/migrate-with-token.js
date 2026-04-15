#!/usr/bin/env node
// Run with: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/migrate-with-token.js
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var')
  console.error('Get one at: https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

const sql = `
create table if not exists activation_leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  owner_name text,
  phone text not null,
  sector text not null,
  recommended_product text not null,
  heat_score int not null,
  heat_level text not null,
  location text not null,
  agent_name text not null,
  source_type text not null check (source_type in ('entered', 'discovered')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'replied', 'booked', 'dead')),
  has_website boolean not null default false,
  google_maps_url text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  replied_at timestamptz
);

create table if not exists activation_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references activation_leads(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  body text not null,
  sequence_day int,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'delivered', 'failed', 'cancelled')),
  channel text not null default 'whatsapp',
  sent_at timestamptz,
  scheduled_for timestamptz
);

create index if not exists activation_leads_status_idx on activation_leads(status);
create index if not exists activation_messages_lead_id_idx on activation_messages(lead_id);
create index if not exists activation_messages_scheduled_idx on activation_messages(scheduled_for) where status = 'scheduled';
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
    console.log('✓ Tables created successfully')
    console.log('✓ activation_leads')
    console.log('✓ activation_messages')
    console.log('✓ Indexes')
    console.log('\nMigration complete. Activation system is ready.')
  })
  .catch((err) => {
    console.error('Request failed:', err.message)
    process.exit(1)
  })
