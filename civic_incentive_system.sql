-- 1. Create Certificates Table
create table if not exists civic_certificates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  certificate_type text not null, -- 'Bronze Civic Contributor', 'Silver...', 'Gold...'
  issue_date timestamp with time zone default now(),
  verification_code text unique not null,
  report_count_at_issue integer default 0,
  points_at_issue integer default 0,
  download_url text, -- simplified for now
  
  constraint unique_user_cert_type unique (user_id, certificate_type)
);

-- 2. Enable RLS
alter table civic_certificates enable row level security;

create policy "Users can view own certificates"
  on civic_certificates for select
  using ( auth.uid() = user_id );

-- 3. Stored Procedure for Secure Generation
create or replace function claim_civic_certificate(p_certificate_type text, p_report_count int)
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_points int;
  v_existing_cert uuid;
  v_required_points int;
  v_new_cert_id uuid;
  v_verify_code text;
  v_cert_title text;
begin
  v_user_id := auth.uid();
  
  -- Get current points
  select points into v_points from profiles where id = v_user_id;
  
  -- Define thresholds (Hardcoded in DB for security)
  if p_certificate_type = 'Bronze' then
    v_required_points := 60;
    v_cert_title := 'Bronze Civic Contributor';
  elsif p_certificate_type = 'Silver' then
    v_required_points := 120;
    v_cert_title := 'Silver Civic Contributor';
  elsif p_certificate_type = 'Gold' then
    v_required_points := 300;
    v_cert_title := 'Gold Civic Contributor';
  else
    raise exception 'Invalid certificate type';
  end if;

  if v_points < v_required_points then
    raise exception 'Insufficient points for this certificate (Required: %, Has: %)', v_required_points, v_points;
  end if;

  -- Check if already claimed
  select id into v_existing_cert from civic_certificates 
  where user_id = v_user_id and certificate_type = v_cert_title;
  
  if v_existing_cert is not null then
    raise exception 'Certificate already claimed';
  end if;

  -- Generate unique verification code (Simple example)
  v_verify_code := upper(substring(md5(random()::text || v_user_id::text) from 1 for 12));
  
  insert into civic_certificates (user_id, certificate_type, verification_code, report_count_at_issue, points_at_issue)
  values (v_user_id, v_cert_title, v_verify_code, p_report_count, v_points)
  returning id into v_new_cert_id;
  
  return json_build_object(
    'id', v_new_cert_id, 
    'code', v_verify_code, 
    'title', v_cert_title,
    'date', now()
  );
end;
$$;
