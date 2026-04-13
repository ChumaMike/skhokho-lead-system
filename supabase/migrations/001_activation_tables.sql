-- supabase/migrations/001_activation_tables.sql

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
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'replied', 'booked', 'dead')),
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
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'delivered', 'failed', 'cancelled')),
  channel text not null default 'whatsapp',
  sent_at timestamptz,
  scheduled_for timestamptz
);

create index if not exists activation_leads_status_idx on activation_leads(status);
create index if not exists activation_messages_lead_id_idx on activation_messages(lead_id);
create index if not exists activation_messages_scheduled_idx
  on activation_messages(scheduled_for)
  where status = 'scheduled';
