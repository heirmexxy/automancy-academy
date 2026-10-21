-- Automancy Academy · 0010 WhatsApp lesson videos: public Storage bucket for the MP4s the bot sends
-- Files are rendered by scripts/render-whatsapp-videos.mjs and uploaded by scripts/upload-whatsapp-media.mjs
-- (service role). Run after 0009_whatsapp.sql.

-- Public bucket: anyone with the exact URL can fetch a file through /storage/v1/object/public/wa-media/<file>
-- (WhatsApp's servers fetch the link). Max 16 MB, MP4 only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wa-media', 'wa-media', true, 16777216, array['video/mp4'])
on conflict (id) do update set public = true, file_size_limit = 16777216, allowed_mime_types = array['video/mp4'];

-- No listing: public URLs do not need a SELECT policy on storage.objects, and adding one would let anon
-- clients list the bucket. So there are deliberately no policies for 'wa-media' (no select/insert/update/delete);
-- only the service role (which bypasses RLS) writes. Drop any listing policy left from experiments.
drop policy if exists "wa-media: public read" on storage.objects;
