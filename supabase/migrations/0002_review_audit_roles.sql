-- Fraud review fields, leaderboard policy, offline verification, disputes, append-only audit log.

alter table campaigns
  add column if not exists leaderboard_basis text not null default 'money' check (leaderboard_basis in ('money','gifts','donors')),
  add column if not exists self_donation text not null default 'count' check (self_donation in ('count','exclude')),
  add column if not exists cutoff_at timestamptz,
  add column if not exists leaderboard_rules text not null default '';

alter table donations
  add column if not exists donor_id text not null default '',
  add column if not exists ip_hash text not null default '',
  add column if not exists card_fingerprint text,
  add column if not exists card_checks jsonb,
  add column if not exists card_funding text,
  add column if not exists card_country text,
  add column if not exists review_state text not null default 'none' check (review_state in ('none','open','cleared','excluded')),
  add column if not exists signals jsonb not null default '[]'::jsonb,
  add column if not exists dispute_state text not null default 'none' check (dispute_state in ('none','open','won','lost')),
  add column if not exists entered_by text,
  add column if not exists verified_by text;

create index if not exists donations_review on donations (review_state) where review_state = 'open';
create index if not exists donations_card on donations (card_fingerprint) where card_fingerprint is not null;
create index if not exists donations_donor on donations (donor_id);

create table if not exists audit_log (
  id text primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at on audit_log (at desc);
alter table audit_log enable row level security;
revoke all on audit_log from anon, authenticated;

-- Append-only: even the service role cannot rewrite history.
create or replace function audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
drop trigger if exists audit_log_no_update on audit_log;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_immutable();
