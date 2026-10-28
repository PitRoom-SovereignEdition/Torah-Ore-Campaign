-- Yeshiva campaign schema.
-- Security model: the Next.js server talks to Postgres with the SERVICE ROLE key. Every table has
-- Row Level Security enabled and NO policies for anon/authenticated, so the public API key can read
-- nothing from the base tables (donor emails/addresses stay private). The only thing exposed to
-- the public key is the `public_donor_wall` view, which projects display fields only.

create table if not exists campaigns (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  long_description text not null default '',
  goal_cents bigint not null,
  bonus_goal_cents bigint,
  currency text not null default 'USD',
  fx_rates jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  hero_media jsonb not null default '[]'::jsonb,
  video_url text,
  charity_name text not null default '',
  charity_reg_no text not null default '',
  statement_descriptor text not null default '',
  receipt_footer text not null default '',
  terms_url text not null default '',
  contact_email text not null default ''
);

create table if not exists teams (
  id text primary key,
  campaign_id text not null references campaigns(id),
  name text not null,
  goal_cents bigint,
  message text not null default '',
  owner_name text not null,
  owner_email text not null,
  owner_phone text not null default '',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists donations (
  id text primary key,
  campaign_id text not null references campaigns(id),
  team_id text references teams(id),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  campaign_amount_cents bigint not null check (campaign_amount_cents > 0),
  fx_rate numeric not null default 1,
  refunded_cents bigint not null default 0,
  display_name text not null,
  anonymous boolean not null default false,
  show_on_wall boolean not null default true,
  message text not null default '',
  dedication text not null default '',
  donor_name text not null,
  donor_email text not null,
  reference text not null default '',
  address text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  country text not null default '',
  provider text not null check (provider in ('stripe','demo','offline')),
  payment_ref text unique,
  status text not null check (status in ('pending','succeeded','failed','refunded','flagged')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists donations_status_created on donations (status, created_at);
create index if not exists donations_team on donations (team_id);

create table if not exists matchers (
  id text primary key,
  campaign_id text not null references campaigns(id),
  name text not null,
  multiplier numeric not null check (multiplier > 0),
  cap_cents bigint not null check (cap_cents > 0),
  currency text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists likes (
  donation_id text not null references donations(id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (donation_id, voter_hash)
);

-- Webhook idempotency ledger.
create table if not exists processed_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table campaigns enable row level security;
alter table teams enable row level security;
alter table donations enable row level security;
alter table matchers enable row level security;
alter table likes enable row level security;
alter table processed_events enable row level security;

-- Public projection for the donor wall (e.g. for Supabase Realtime / direct client reads later).
-- Only succeeded, consenting donations; anonymous hides the name; no contact details.
create or replace view public_donor_wall as
select
  d.id,
  case when d.anonymous then 'Anonymous' else d.display_name end as display_name,
  d.amount_cents,
  d.currency,
  d.message,
  d.dedication,
  d.team_id,
  d.created_at
from donations d
where d.status = 'succeeded' and d.show_on_wall;

revoke all on all tables in schema public from anon, authenticated;
grant select on public_donor_wall to anon, authenticated;
