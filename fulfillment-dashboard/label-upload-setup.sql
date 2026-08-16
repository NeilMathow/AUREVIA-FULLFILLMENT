-- Run this in the Supabase SQL Editor.
-- This only adds the NEW pieces needed for PDF shipping label uploads
-- (safe to run even if you already ran the original schema.sql).

-- Add the column that stores the uploaded label's URL
alter table orders add column if not exists shipping_label_url text;

-- Create a public storage bucket for uploaded shipping label PDFs
insert into storage.buckets (id, name, public)
values ('shipping-labels', 'shipping-labels', true)
on conflict (id) do nothing;

-- Allow anyone with the anon key to read/upload/delete label files (internal tool use)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and policyname = 'Public read shipping labels'
  ) then
    create policy "Public read shipping labels"
      on storage.objects for select
      using (bucket_id = 'shipping-labels');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and policyname = 'Anyone can upload shipping labels'
  ) then
    create policy "Anyone can upload shipping labels"
      on storage.objects for insert
      with check (bucket_id = 'shipping-labels');
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'objects' and policyname = 'Anyone can delete shipping labels'
  ) then
    create policy "Anyone can delete shipping labels"
      on storage.objects for delete
      using (bucket_id = 'shipping-labels');
  end if;
end $$;
