-- Pulse Calendar Gateway — Supabase Schema
-- Run this in the Supabase SQL Editor to initialize the database.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── clients ──────────────────────────────────────────────────────────────────
create table if not exists clients (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  calendar_id         text not null,
  timezone            text not null default 'America/New_York',
  appointment_duration integer not null default 30,
  business_hours      jsonb not null default '{
    "monday":    {"open":"09:00","close":"17:00"},
    "tuesday":   {"open":"09:00","close":"17:00"},
    "wednesday": {"open":"09:00","close":"17:00"},
    "thursday":  {"open":"09:00","close":"17:00"},
    "friday":    {"open":"09:00","close":"17:00"},
    "saturday":  null,
    "sunday":    null
  }'::jsonb,
  buffers             jsonb not null default '{"pre":0,"post":0}'::jsonb,
  api_key             text not null unique,
  fallback_email      text,
  assistant_id        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── bookings ─────────────────────────────────────────────────────────────────
create table if not exists bookings (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid references clients(id) on delete set null,
  caller_name      text,
  business_name    text,
  email            text,
  phone            text,
  slot_start       timestamptz not null,
  slot_end         timestamptz not null,
  timezone         text,
  notes            text,
  google_event_id  text,
  status           text not null default 'confirmed' check (status in ('confirmed', 'failed', 'cancelled')),
  created_at       timestamptz not null default now()
);

-- ─── logs ─────────────────────────────────────────────────────────────────────
create table if not exists logs (
  id         uuid primary key default uuid_generate_v4(),
  client_id  text,
  type       text not null check (type in ('availability_check', 'booking_attempt', 'booking_success', 'error')),
  payload    jsonb,
  response   jsonb,
  error      text,
  created_at timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists bookings_client_id_idx    on bookings(client_id);
create index if not exists bookings_slot_start_idx   on bookings(slot_start);
create index if not exists bookings_created_at_idx   on bookings(created_at desc);
create index if not exists logs_client_id_idx        on logs(client_id);
create index if not exists logs_type_idx             on logs(type);
create index if not exists logs_created_at_idx       on logs(created_at desc);

-- ─── Row Level Security (open read for admin UI — tighten for production) ─────
alter table clients  enable row level security;
alter table bookings enable row level security;
alter table logs     enable row level security;

create policy "anon read clients"  on clients  for select using (true);
create policy "anon read bookings" on bookings for select using (true);
create policy "anon read logs"     on logs     for select using (true);

create policy "anon write clients"  on clients  for all using (true) with check (true);
create policy "anon write bookings" on bookings for all using (true) with check (true);
create policy "anon write logs"     on logs     for all using (true) with check (true);

-- Service role (used by Netlify Functions) bypasses RLS automatically.
