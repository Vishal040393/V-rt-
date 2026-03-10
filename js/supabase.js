/* ============================================================
   supabase.js — Supabase client
   Depends on: CDN script loaded before this in HTML
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ============================================================ */

const { createClient } = supabase;

const sb = createClient(
  'https://ipxevcxopkpivddddmng.supabase.co',
  'sb_publishable_0NOEYDp57i-pkX2Y47JOyQ_WCN-DjPJ'
);
