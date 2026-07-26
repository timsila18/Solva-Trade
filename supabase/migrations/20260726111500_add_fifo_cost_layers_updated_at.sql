alter table public.fifo_cost_layers
  add column if not exists updated_at timestamptz not null default now();

