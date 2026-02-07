-- Enable Realtime for the civic_reports table
-- Run this in your Supabase SQL Editor to allow live updates

begin;
  -- Remove the table from the publication if it exists to avoid errors
  alter publication supabase_realtime drop table civic_reports;
exception when others then null;
end;

-- Add the table to the publication
alter publication supabase_realtime add table civic_reports;

-- Verify it's enabled
select * from pg_publication_tables where pubname = 'supabase_realtime';
