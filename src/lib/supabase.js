

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dhcoivmfhhtgnlqseyfl.supabase.co'; 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoY29pdm1maGh0Z25scXNleWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MzQ2NTQsImV4cCI6MjEwMTQxMDY1NH0.-FrAZcsajgZ-XLhpAwSCx7pPe1Q7-H3HhKYPdRFdeEg';

export const supabase = createClient( 
	supabaseUrl, 
	supabaseAnonKey 
);

