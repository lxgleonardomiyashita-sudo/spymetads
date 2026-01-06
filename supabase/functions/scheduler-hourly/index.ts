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

function getCurrentWindow(hour: number): string {
  if (hour >= 0 && hour <= 4) return 'dawn';
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening';
}

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

interface ExtractedAd {
  ad_archive_id: string;
  ad_start_date: string | null;
  ad_body: string | null;
  ad_title: string | null;
  preview_url: string | null;
  link_url: string | null;
  platforms: string[];
}

function extractAdsFromContent(htmlContent: string, markdownContent: string): ExtractedAd[] {
  const ads: ExtractedAd[] = [];
  const seenIds = new Set<string>();

  const adIdPattern = /ad_archive_id[=:]?\s*["']?(\d{10,20})["']?/gi;
  let match;
  
  while ((match = adIdPattern.exec(htmlContent)) !== null) {
    const adId = match[1];
    if (!seenIds.has(adId)) {
      seenIds.add(adId);
      ads.push({
        ad_archive_id: adId,
        ad_start_date: null,
        ad_body: null,
        ad_title: null,
        preview_url: null,
        link_url: null,
        platforms: [],
      });
    }
  }

  const dataAdPattern = /data-ad-archive-id=["'](\d{10,20})["']/gi;
  while ((match = dataAdPattern.exec(htmlContent)) !== null) {
    const adId = match[1];
    if (!seenIds.has(adId)) {
      seenIds.add(adId);
      ads.push({
        ad_archive_id: adId,
        ad_start_date: null,
        ad_body: null,
        ad_title: null,
        preview_url: null,
        link_url: null,
        platforms: [],
      });
    }
  }

  const startDatePattern = /Started running on\s*([\w\s,]+\d{4})/gi;
  const dates: string[] = [];
  while ((match = startDatePattern.exec(markdownContent)) !== null) {
    dates.push(match[1].trim());
  }

  if (dates.length > 0) {
    ads.forEach((ad, index) => {
      if (dates[index]) {
        try {
          const parsed = new Date(dates[index]);
          if (!isNaN(parsed.getTime())) {
            ad.ad_start_date = parsed.toISOString();
          }
        } catch {}
      }
    });
  }

  return ads;
}

function calculateDaysActive(startDate: string | null): number {
  if (!startDate) return 0;
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
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

      console.log(`[${monitor.name}] Local: ${localDay} ${localHour}:00 (${timezone})`);

      if (!config.days.includes(localDay)) {
        skipReasons[monitor.id] = `Day ${localDay} not in active days`;
        continue;
      }

      if (!isWithinWindow(localHour, config.windows)) {
        skipReasons[monitor.id] = `Hour ${localHour} not within windows`;
        continue;
      }

      const lastReading = lastReadingMap[monitor.id] || null;
      if (!shouldRunBasedOnInterval(lastReading, config.interval, now)) {
        skipReasons[monitor.id] = `Interval not reached`;
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

          const markdownContent = scrapeData.data?.markdown || '';
          const htmlContent = scrapeData.data?.html || '';
          const content = markdownContent || htmlContent;

          let adsCount = 0;
          let foundMatch = false;

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

          // Extract and save individual ads
          const extractedAds = extractAdsFromContent(htmlContent, markdownContent);
          const nowStr = new Date().toISOString();

          if (extractedAds.length > 0) {
            // Mark existing ads as potentially inactive
            await supabase
              .from('ad_details')
              .update({ is_active: false })
              .eq('monitor_id', monitor.id)
              .lt('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

            // Upsert new ads
            for (const ad of extractedAds) {
              const daysActive = calculateDaysActive(ad.ad_start_date);

              await supabase
                .from('ad_details')
                .upsert(
                  {
                    monitor_id: monitor.id,
                    ad_archive_id: ad.ad_archive_id,
                    ad_start_date: ad.ad_start_date,
                    ad_body: ad.ad_body,
                    days_active: daysActive,
                    is_active: true,
                    last_seen_at: nowStr,
                    updated_at: nowStr,
                  },
                  { onConflict: 'monitor_id,ad_archive_id' }
                );
            }

            console.log(`[${monitor.name}] Saved ${extractedAds.length} ads`);
          }

          console.log(`[${monitor.name}] SUCCESS: ${adsCount} ads`);
          return { monitor: monitor.name, success: true, ads_count: adsCount, extracted_ads: extractedAds.length };

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
