import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { createClient } from "@supabase/supabase-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ✅ CORREÇÃO: Usando a sua URL Base correta
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://foulnpmrfyuwvqppdrnt.supabase.co';

// Você precisará da sua chave "anon public" do Supabase aqui.
// Se não tiver agora, deixe este placeholder, o app vai abrir (sem tela branca),
// mas as chamadas de API falharão até você colocar a chave real.
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdWxucG1yZnl1d3ZxcHBkcm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDE1NjYsImV4cCI6MjA4NTA3NzU2Nn0.NX3r510aLr4CAROBdFV75VvVjbIz4aj9qEetsF6UQBU';

export const supabase = createClient(supabaseUrl, supabaseKey);