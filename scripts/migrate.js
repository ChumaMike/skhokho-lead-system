#!/usr/bin/env node
// Run with: SUPABASE_DB_PASSWORD=xxx node scripts/migrate.js
const { Client } = require('pg')

const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD env var first')
  console.error('Get it from: https://supabase.com/dashboard/project/fxnbghdnajcldnnkjewc/settings/database')
  process.exit(1)
}

const client = new Client({
  host: 'db.fxnbghdnajcldnnkjewc.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
})

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

async function run() {
  try {
    await client.connect()
    console.log('Connected to Supabase')
    await client.query(sql)
    console.log('✓ activation_leads table created')
    console.log('✓ activation_messages table created')
    console.log('✓ Indexes created')
    console.log('Migration complete.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
