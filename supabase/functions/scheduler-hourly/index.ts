import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Window definitions with exact hour boundaries
const WINDOW_HOURS: Record<string, { start: number; end: number }> = {
  dawn: { start: 0, end: 4 },      // 00:00 - 04:59
  morning: { start: 5, end: 11 },  // 05:00 - 11:59
  afternoon: { start: 12, end: 17 }, // 12:00 - 17:59
  evening: { start: 18, end: 23 }, // 18:00 - 23:59
};

// Get current window based on hour
function getCurrentWindow(hour: number): string {
  if (hour >= 0 && hour <= 4) return 'dawn';
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening';
}

// Convert UTC to timezone-adjusted hour
function getLocalHour(utcDate: Date, timezone: string): number {
  try {
    const localTime = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    // Fallback to Brazil time (UTC-3)
    return (utcDate.getUTCHours() - 3 + 24) % 24;
  }
}

// Get day abbreviation in local timezone
function getLocalDay(utcDate: Date, timezone: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', timeZone: timezone };
    return utcDate.toLocaleDateString('en-US', options).toLowerCase();
  } catch {
    return utcDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  }
}

// Check if current time is within a window
function isWithinWindow(hour: number, windows: string[]): boolean {
  for (const windowName of windows) {
    const window = WINDOW_HOURS[windowName];
    if (window && hour >= window.start && hour <= window.end) {
      return true;
    }
  }
  return false;
}

// Check if enough time has passed since last reading based on interval
function shouldRunBasedOnInterval(
  lastReadingTime: Date | null,
  intervalMinutes: number,
  now: Date
): boolean {
  if (!lastReadingTime) {
    return true; // Never ran, should run
  }
  
  const elapsedMs = now.getTime() - lastReadingTime.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  
  // Add small buffer (2 min) to avoid edge cases
  return elapsedMinutes >= (intervalMinutes - 2);
}

serve(async (req) => {
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
    console.log(`[Scheduler] Started at ${now.toISOString()}`);

    // Fetch all active monitors with their last reading
    const { data: monitors, error: monitorsError } = await supabase
      .from('monitors')
      .select('id, name, ad_library_url, schedule_config, timezone')
      .eq('is_active', true);

    if (monitorsError) {
      console.error('[Scheduler] Error fetching monitors:', monitorsError);
      throw monitorsError;
    }

    if (!monitors || monitors.length === 0) {
      console.log('[Scheduler] No active monitors found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active monitors', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Scheduler] Found ${monitors.length} active monitors`);

    // Fetch last reading for each monitor
    const monitorIds = monitors.map(m => m.id);
    const { data: lastReadings } = await supabase
      .from('readings')
      .select('monitor_id, timestamp')
      .in('monitor_id', monitorIds)
      .order('timestamp', { ascending: false });

    // Create map of monitor_id -> last reading timestamp
    const lastReadingMap: Record<string, Date> = {};
    if (lastReadings) {
      for (const reading of lastReadings) {
        if (!lastReadingMap[reading.monitor_id]) {
          lastReadingMap[reading.monitor_id] = new Date(reading.timestamp);
        }
      }
    }

    // Filter monitors that should run now
    const monitorsToRun: typeof monitors = [];
    const skipReasons: Record<string, string> = {};

    for (const monitor of monitors) {
      const config = monitor.schedule_config as {
        interval: number;
        days: string[];
        windows: string[];
      };

      const timezone = monitor.timezone || 'America/Sao_Paulo';
      const localHour = getLocalHour(now, timezone);
      const localDay = getLocalDay(now, timezone);
      const currentWindow = getCurrentWindow(localHour);

      console.log(`[${monitor.name}] Local: ${localDay} ${localHour}:00 (${timezone}), window: ${currentWindow}`);
      console.log(`[${monitor.name}] Config: days=${config.days.join(',')}, windows=${config.windows.join(',')}, interval=${config.interval}min`);

      // 1. Check if today is an active day
      if (!config.days.includes(localDay)) {
        skipReasons[monitor.id] = `Day ${localDay} not in active days`;
        console.log(`[${monitor.name}] SKIP: ${skipReasons[monitor.id]}`);
        continue;
      }

      // 2. Check if current hour is within any active window
      if (!isWithinWindow(localHour, config.windows)) {
        skipReasons[monitor.id] = `Hour ${localHour} not within windows [${config.windows.join(', ')}]`;
        console.log(`[${monitor.name}] SKIP: ${skipReasons[monitor.id]}`);
        continue;
      }

      // 3. Check if enough time has passed since last reading
      const lastReading = lastReadingMap[monitor.id] || null;
      const shouldRun = shouldRunBasedOnInterval(lastReading, config.interval, now);

      if (!shouldRun) {
        const minutesSince = lastReading 
          ? Math.floor((now.getTime() - lastReading.getTime()) / (1000 * 60))
          : 0;
        skipReasons[monitor.id] = `Last reading ${minutesSince}min ago, interval is ${config.interval}min`;
        console.log(`[${monitor.name}] SKIP: ${skipReasons[monitor.id]}`);
        continue;
      }

      const lastReadingInfo = lastReading 
        ? `${Math.floor((now.getTime() - lastReading.getTime()) / (1000 * 60))}min ago`
        : 'never';
      console.log(`[${monitor.name}] WILL RUN: Last reading ${lastReadingInfo}, interval ${config.interval}min`);
      monitorsToRun.push(monitor);
    }

    console.log(`[Scheduler] ${monitorsToRun.length}/${monitors.length} monitors will run`);

    if (monitorsToRun.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No monitors need to run at this time',
          total: monitors.length,
          processed: 0,
          skipReasons 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each monitor
    const results = await Promise.allSettled(
      monitorsToRun.map(async (monitor) => {
        console.log(`[${monitor.name}] Starting scrape...`);
        
        try {
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
            console.error(`[${monitor.name}] Scrape failed:`, scrapeData);
            
            await supabase.from('readings').insert({
              monitor_id: monitor.id,
              ads_active_count: 0,
              source_method: 'public_parse',
              status: 'error',
              error_message: scrapeData.error || 'Scrape failed',
            });

            return { monitor: monitor.name, success: false, error: scrapeData.error };
          }

          // Extract ads count from content
          const content = scrapeData.data?.markdown || scrapeData.data?.html || '';
          let adsCount = 0;
          let foundMatch = false;

          // Patterns for extracting ad count
          const patterns = [
            /(\d{1,3}(?:[.,]\d{3})*)\s*(?:results?|resultados?)/i,
            /(?:about|cerca de|approximately)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?)/i,
            /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?|anuncios?)/i,
            /(?:showing|mostrando)\s*\d+\s*(?:of|de)\s*(\d{1,3}(?:[.,]\d{3})*)/i,
            /Total:\s*(\d{1,3}(?:[.,]\d{3})*)/i,
          ];

          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              adsCount = parseInt(match[1].replace(/[.,]/g, ''), 10);
              foundMatch = true;
              console.log(`[${monitor.name}] Matched pattern: ${pattern}, count: ${adsCount}`);
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
                  console.log(`[${monitor.name}] Fallback number found: ${adsCount}`);
                  break;
                }
              }
            }
          }

          // Save reading
          const { error: insertError } = await supabase.from('readings').insert({
            monitor_id: monitor.id,
            ads_active_count: adsCount,
            source_method: 'public_parse',
            status: foundMatch ? 'ok' : 'error',
            error_message: foundMatch ? null : 'Could not extract ads count',
          });

          if (insertError) {
            console.error(`[${monitor.name}] Insert error:`, insertError);
          }

          console.log(`[${monitor.name}] SUCCESS: ${adsCount} ads (matched: ${foundMatch})`);
          return { monitor: monitor.name, success: true, ads_count: adsCount };

        } catch (error) {
          console.error(`[${monitor.name}] Exception:`, error);
          
          await supabase.from('readings').insert({
            monitor_id: monitor.id,
            ads_active_count: 0,
            source_method: 'public_parse',
            status: 'error',
            error_message: String(error),
          });

          return { monitor: monitor.name, success: false, error: String(error) };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;

    console.log(`[Scheduler] Completed: ${successful} success, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: monitors.length,
        processed: monitorsToRun.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'rejected' }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Scheduler] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
