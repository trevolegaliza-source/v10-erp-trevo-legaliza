import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qlpmwjdtgxsmadfczejp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscG13amR0Z3hzbWFkZmN6ZWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTkyNzksImV4cCI6MjA4ODc3NTI3OX0.G7mVoswZzrDBm0qAJzUN-IaCcoF4yX0Ga8qFNkHKYjk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
