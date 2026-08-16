import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev if env vars are missing instead of silently breaking.
  console.warn(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type OrderItem = {
  peptide: string;
  units: string;
};

export type Order = {
  id: string;
  person: string;
  address: string | null;
  carrier: string | null;
  tracking: string | null;
  notes: string | null;
  items: OrderItem[];
  status: 'pending' | 'processing' | 'shipped' | 'cancelled';
  shipping_label_url: string | null;
  created_at: string;
};
