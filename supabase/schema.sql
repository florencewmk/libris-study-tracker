create extension if not exists pgcrypto;

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location text not null check (char_length(location) between 1 and 100),
  subject text not null check (char_length(subject) between 1 and 80),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  created_at timestamptz not null default now()
);

create table if not exists public.library_check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location text not null check (char_length(location) between 1 and 100),
  checked_in_at timestamptz not null default now()
);

create index if not exists study_sessions_user_started_idx on public.study_sessions (user_id, started_at desc);
create index if not exists library_check_ins_user_checked_idx on public.library_check_ins (user_id, checked_in_at desc);

alter table public.study_sessions enable row level security;
alter table public.library_check_ins enable row level security;

drop policy if exists "Users manage their own sessions" on public.study_sessions;
create policy "Users manage their own sessions"
on public.study_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own check-ins" on public.library_check_ins;
create policy "Users manage their own check-ins"
on public.library_check_ins for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
