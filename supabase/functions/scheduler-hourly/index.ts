import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    
    console.log(`Scheduler running at ${now.toISOString()}, hour: ${currentHour}, day: ${currentDay}`);

    // Determine current window based on Brazil time (UTC-3)
    const brazilHour = (currentHour - 3 + 24) % 24;
    let currentWindow: string;
    if (brazilHour >= 5 && brazilHour < 12) {
      currentWindow = 'morning';
    } else if (brazilHour >= 12 && brazilHour < 18) {
      currentWindow = 'afternoon';
    } else if (brazilHour >= 18 && brazilHour < 24) {
      currentWindow = 'evening';
    } else {
      // Night hours (0-5) - skip
      console.log('Night hours, skipping scheduler');
      return new Response(
        JSON.stringify({ success: true, message: 'Night hours, skipping', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Brazil hour: ${brazilHour}, current window: ${currentWindow}`);

    // Fetch all active monitors
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('id, name, ad_library_url, schedule_config, timezone')
      .eq('is_active', true);

    if (monitorsError) {
      console.error('Error fetching monitors:', monitorsError);
      throw monitorsError;
    }

    if (!monitors || monitors.length === 0) {
      console.log('No active monitors found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active monitors', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${monitors.length} active monitors`);

    // Map day abbreviations
    const dayMap: Record<string, string> = {
      'sun': 'sun', 'mon': 'mon', 'tue': 'tue', 'wed': 'wed',
      'thu': 'thu', 'fri': 'fri', 'sat': 'sat'
    };

    // Filter monitors that should run now
    const monitorsToRun = monitors.filter((monitor) => {
      const config = monitor.schedule_config as {
        interval: number;
        days: string[];
        windows: string[];
      };

      // Check if today is an active day
      const isActiveDay = config.days.includes(currentDay);
      if (!isActiveDay) {
        console.log(`Monitor ${monitor.name}: not active on ${currentDay}`);
        return false;
      }

      // Check if current window is active
      const isActiveWindow = config.windows.includes(currentWindow);
      if (!isActiveWindow) {
        console.log(`Monitor ${monitor.name}: not active in ${currentWindow} window`);
        return false;
      }

      // For hourly scheduler, we only run on the hour
      // The interval is handled by the cron job frequency
      console.log(`Monitor ${monitor.name}: scheduled to run`);
      return true;
    });

    console.log(`${monitorsToRun.length} monitors scheduled to run`);

    // Process each monitor
    const results = await Promise.allSettled(
      monitorsToRun.map(async (monitor) => {
        console.log(`Processing monitor: ${monitor.name}`);
        
        try {
          // Scrape the URL
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: monitor.ad_library_url,
              formats: ['markdown', 'html'],
              onlyMainContent: false,
              waitFor: 5000,
            }),
          });

          const scrapeData = await scrapeResponse.json();

          if (!scrapeResponse.ok) {
            console.error(`Scrape failed for ${monitor.name}:`, scrapeData);
            
            await supabase.from('readings').insert({
              monitor_id: monitor.id,
              ads_active_count: 0,
              source_method: 'public_parse',
              status: 'error',
              error_message: scrapeData.error || 'Scrape failed',
            });

            return { monitor: monitor.name, success: false, error: scrapeData.error };
          }

          // Extract ads count
          const content = scrapeData.data?.markdown || scrapeData.data?.html || '';
          let adsCount = 0;
          let foundMatch = false;

          // Pattern matching for ads count
          const patterns = [
            /(\d{1,3}(?:[.,]\d{3})*)\s*(?:results?|resultados?)/i,
            /(?:about|cerca de|approximately)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?)/i,
            /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?|anuncios?)/i,
            /(?:showing|mostrando)\s*\d+\s*(?:of|de)\s*(\d{1,3}(?:[.,]\d{3})*)/i,
          ];

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              adsCount = parseInt(match[1].replace(/[.,]/g, ''), 10);
              foundMatch = true;
              break;
            }
          }

          // Fallback: find large numbers
          if (!foundMatch) {
            const allNumbers = content.match(/\d{1,3}(?:[.,]\d{3})+|\d{4,}/g);
            if (allNumbers) {
              for (const numStr of allNumbers) {
                const num = parseInt(numStr.replace(/[.,]/g, ''), 10);
                if (num >= 1 && num <= 10000000) {
                  adsCount = num;
                  foundMatch = true;
                  break;
                }
              }
            }
          }

          // Save reading
          await supabase.from('readings').insert({
            monitor_id: monitor.id,
            ads_active_count: adsCount,
            source_method: 'public_parse',
            status: foundMatch ? 'ok' : 'error',
            error_message: foundMatch ? null : 'Could not extract ads count',
          });

          console.log(`Monitor ${monitor.name}: ${adsCount} ads, found: ${foundMatch}`);
          return { monitor: monitor.name, success: true, ads_count: adsCount };

        } catch (error) {
          console.error(`Error processing ${monitor.name}:`, error);
          return { monitor: monitor.name, success: false, error: String(error) };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;

    console.log(`Scheduler completed: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: monitorsToRun.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'rejected' }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Scheduler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
