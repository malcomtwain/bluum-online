create table public.songs (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  title text not null,
  artist text,
  duration numeric not null,
  url text not null,
  cover_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.songs enable row level security;

-- Create policies
create policy "Users can view their own songs"
  on public.songs for select
  using (auth.uid()::text = user_id);

create policy "Users can insert their own songs"
  on public.songs for insert
  with check (auth.uid()::text = user_id);

create policy "Users can update their own songs"
  on public.songs for update
  using (auth.uid()::text = user_id);

create policy "Users can delete their own songs"
  on public.songs for delete
  using (auth.uid()::text = user_id);

-- Create indexes
create index songs_user_id_idx on public.songs(user_id);
create index songs_created_at_idx on public.songs(created_at desc);

-- Set up triggers for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger handle_songs_updated_at
  before update on public.songs
  for each row
  execute function public.handle_updated_at(); 