import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WINDOW_HOURS: Record<string, { start: number; end: number }> = {
  dawn: { start: 0, end: 4 },
  morning: { start: 5, end: 11 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 18, end: 23 },
};

function getLocalHour(utcDate: Date, timezone: string): number {
  try {
    const localTime = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
    return localTime.getHours();
  } catch {
    return (utcDate.getUTCHours() - 3 + 24) % 24;
  }
}

function getLocalDay(utcDate: Date, timezone: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', timeZone: timezone };
    return utcDate.toLocaleDateString('en-US', options).toLowerCase();
  } catch {
    return utcDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  }
}

function isWithinWindow(hour: number, windows: string[]): boolean {
  for (const windowName of windows) {
    const window = WINDOW_HOURS[windowName];
    if (window && hour >= window.start && hour <= window.end) {
      return true;
    }
  }
  return false;
}

function shouldRunBasedOnInterval(
  lastReadingTime: Date | null,
  intervalMinutes: number,
  now: Date
): boolean {
  if (!lastReadingTime) return true;
  const elapsedMs = now.getTime() - lastReadingTime.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  return elapsedMinutes >= (intervalMinutes - 2);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    console.log(`[Scheduler] Started at ${now.toISOString()}`);

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

    const monitorIds = monitors.map(m => m.id);
    const { data: lastReadings } = await supabase
      .from('readings')
      .select('monitor_id, timestamp')
      .in('monitor_id', monitorIds)
      .order('timestamp', { ascending: false });

    const lastReadingMap: Record<string, Date> = {};
    if (lastReadings) {
      for (const reading of lastReadings) {
        if (!lastReadingMap[reading.monitor_id]) {
          lastReadingMap[reading.monitor_id] = new Date(reading.timestamp);
        }
      }
    }

    const monitorsToRun: typeof monitors = [];

    for (const monitor of monitors) {
      const config = monitor.schedule_config as {
        interval: number;
        days: string[];
        windows: string[];
      };

      const timezone = monitor.timezone || 'America/Sao_Paulo';
      const localHour = getLocalHour(now, timezone);
      const localDay = getLocalDay(now, timezone);

      console.log(`[${monitor.name}] Local: ${localDay} ${localHour}:00 (${timezone})`);

      if (!config.days.includes(localDay)) {
        console.log(`[${monitor.name}] SKIP: Day ${localDay} not active`);
        continue;
      }

      if (!isWithinWindow(localHour, config.windows)) {
        console.log(`[${monitor.name}] SKIP: Hour ${localHour} not in window`);
        continue;
      }

      const lastReading = lastReadingMap[monitor.id] || null;
      if (!shouldRunBasedOnInterval(lastReading, config.interval, now)) {
        console.log(`[${monitor.name}] SKIP: Interval not reached`);
        continue;
      }

      console.log(`[${monitor.name}] WILL RUN`);
      monitorsToRun.push(monitor);
    }

    console.log(`[Scheduler] ${monitorsToRun.length}/${monitors.length} monitors will run`);

    if (monitorsToRun.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No monitors need to run',
          total: monitors.length,
          processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delegate scraping to scrape-ad-library edge function (single source of truth)
    const scrapeUrl = `${supabaseUrl}/functions/v1/scrape-ad-library`;

    const results: Array<Record<string, unknown>> = [];

    for (const monitor of monitorsToRun) {
      console.log(`[${monitor.name}] Delegating to scrape-ad-library...`);

      try {
        const response = await fetch(scrapeUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            monitor_id: monitor.id,
            url: monitor.ad_library_url,
            allow_firecrawl_fallback: false,
          }),
        });

        const data = await response.json().catch(() => ({
          success: false,
          error: `Invalid scrape response (HTTP ${response.status})`,
        }));

        if (data.success) {
          console.log(`[${monitor.name}] SUCCESS: ${data.ads_count} ads (status: ${data.reading_status}, anomaly: ${data.anomaly_detected})`);
        } else {
          console.error(`[${monitor.name}] FAILED: ${data.error}`);
        }

        results.push({ monitor: monitor.name, ...data });
      } catch (error) {
        console.error(`[${monitor.name}] Exception:`, error);
        results.push({ monitor: monitor.name, success: false, error: String(error) });
      }

      // Avoid burst requests that trigger blocking
      await sleep(350);
    }

    const successful = results.filter((r) => Boolean(r.success)).length;
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
