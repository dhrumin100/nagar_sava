-- Create a table for public user profiles
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'citizen', -- 'citizen', 'authority', 'department'
  dept_id text, -- e.g., 'road_dept' if role is department
  points integer default 0,
  level text default 'Novice Citizen',
  updated_at timestamp with time zone
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Function to handle new user signup automatically
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, points)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'citizen', 0);
  return new;
end;
$$;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Policies for civic_reports to link with profiles if needed
-- (Existing table assumed)
