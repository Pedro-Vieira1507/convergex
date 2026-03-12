import { createClient } from '@supabase/supabase-js';

// Usamos as variáveis de ambiente. Você precisará colocar elas no .env do Site Institucional
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://lnmbnjiwlvbmqhepkpvf.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxubWJuaml3bHZibXFoZXBrcHZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDUxNzgsImV4cCI6MjA4ODcyMTE3OH0.G4-ZILPLPOo3fyKaB6RZBEyGazwJeE2mNWUVn47cm1A";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);