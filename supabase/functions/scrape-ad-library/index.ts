import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapeRequest {
  monitor_id: string;
  url: string;
}

/**
 * Detect if a new count is an anomalous spike compared to recent history.
 */
function isAnomalousSpike(newCount: number, recentCounts: number[]): boolean {
  if (recentCounts.length < 2) return false;
  if (newCount === 0) return false;
  
  if (newCount > 10000) {
    console.log(`ANOMALY DETECTED (absolute threshold): ${newCount} exceeds 10,000 limit`);
    return true;
  }

  const sameValueCount = recentCounts.filter(c => c === newCount).length;
  if (sameValueCount >= 3 && newCount > 500) {
    console.log(`ANOMALY DETECTED (steady-state): ${newCount} appeared ${sameValueCount} times`);
    return true;
  }

  const validCounts = recentCounts.filter(c => c > 0 && c < 10000);
  if (validCounts.length === 0) {
    return newCount > 100;
  }

  const sorted = [...validCounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const maxRecent = Math.max(...validCounts);

  const spikeRatio = newCount / median;
  const maxRatio = newCount / maxRecent;

  if (spikeRatio > 10 && maxRatio > 5) {
    console.log(`ANOMALY DETECTED (spike): new=${newCount}, median=${median}, max=${maxRecent}`);
    return true;
  }

  return false;
}

/**
 * Fetch Facebook Ad Library page directly (no Firecrawl needed).
 * Uses multiple user-agent strategies and direct HTTP fetch.
 */
async function fetchAdLibraryPage(url: string): Promise<{ html: string; success: boolean; error?: string }> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  // Try with cache buster
  const cacheBuster = Date.now();
  const urlWithCb = url.includes('?') ? `${url}&_cb=${cacheBuster}` : `${url}?_cb=${cacheBuster}`;

  for (const ua of userAgents) {
    try {
      const response = await fetch(urlWithCb, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        console.log(`Fetch attempt failed with status ${response.status}, trying next UA...`);
        continue;
      }

      const html = await response.text();
      
      if (html.length < 500) {
        console.log(`Response too short (${html.length} chars), trying next UA...`);
        continue;
      }

      console.log(`Successfully fetched page (${html.length} chars)`);
      return { html, success: true };
    } catch (error) {
      console.log(`Fetch attempt failed: ${error instanceof Error ? error.message : 'unknown'}`);
      continue;
    }
  }

  return { html: '', success: false, error: 'All fetch attempts failed' };
}

/**
 * Extract the active ads count from the HTML content.
 */
function extractAdsCount(content: string): { count: number; found: boolean } {
  // Strong signal for 0 ads
  const zeroPatterns = [
    /\bno\s+results\b/i,
    /\bnenhum\s+resultado\b/i,
    /\bnenhum\s+an[úu]ncio\b/i,
    /\bn[ãa]o\s+h[áa]\s+an[úu]ncios\b/i,
    /\b0\s*(?:results?|resultados?|ads?|an[úu]ncios?)\b/i,
    /\bno\s+ads\b/i,
  ];

  if (zeroPatterns.some(p => p.test(content))) {
    console.log('Detected zero ads message in page content');
    return { count: 0, found: true };
  }

  // EXCLUSION patterns: historical/total context numbers
  const exclusionPatterns = [
    /(?:ran|veiculou|publicou|total\s+(?:of|de))\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|an[úu]ncios?)/gi,
    /(\d{1,3}(?:[.,]\d{3})*)\s*(?:total\s+)?(?:ads?|an[úu]ncios?)\s*(?:ran|veiculad|publicad|in\s+total|no\s+total)/gi,
    /(?:this\s+page|esta\s+p[áa]gina)\s+.*?(\d{1,3}(?:[.,]\d{3})*)/gi,
    /(?:page\s+transparency|transpar[êe]ncia)\s+.*?(\d{1,3}(?:[.,]\d{3})*)/gi,
    /(?:about\s+this\s+page|sobre\s+esta\s+p[áa]gina)[\s\S]*?(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|an[úu]ncios?)/gi,
    /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?\s+from|an[úu]ncios?\s+d[ea])\s+(?:this|esta)/gi,
  ];

  const excludedNumbers = new Set<number>();
  for (const pattern of exclusionPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const num = parseInt(match[1].replace(/[.,]/g, ''), 10);
      excludedNumbers.add(num);
      console.log(`Excluding historical number: ${num}`);
    }
  }

  // Active ad count patterns
  const patterns = [
    /(\d{1,3}(?:[.,]\d{3})*)\s*(?:results?|resultados?)/i,
    /(?:about|cerca de|approximately|aprox\.?)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?)/i,
    /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?|anuncios?)/i,
    /(?:showing|mostrando|displaying).*?(\d{1,3}(?:[.,]\d{3})*)/i,
    /(?:showing|mostrando)\s*\d+\s*(?:of|de)\s*(\d{1,3}(?:[.,]\d{3})*)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const candidate = parseInt(match[1].replace(/[.,]/g, ''), 10);
      if (excludedNumbers.has(candidate)) {
        console.log(`Skipping excluded historical number: ${candidate}`);
        continue;
      }
      console.log(`Found ads count via pattern: ${candidate}`);
      return { count: candidate, found: true };
    }
  }

  console.log('No confident ads count found, defaulting to 0');
  return { count: 0, found: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { monitor_id, url }: ScrapeRequest = await req.json();

    if (!monitor_id || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'monitor_id and url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping Ad Library URL for monitor ${monitor_id}: ${url}`);

    // Fetch recent readings for anomaly detection
    const { data: recentReadings } = await supabase
      .from('readings')
      .select('ads_active_count')
      .eq('monitor_id', monitor_id)
      .eq('status', 'ok')
      .order('timestamp', { ascending: false })
      .limit(10);

    const recentCounts = (recentReadings || []).map(r => r.ads_active_count);
    console.log(`Recent counts for anomaly check: [${recentCounts.join(', ')}]`);

    // Direct fetch — no Firecrawl needed for Facebook Ad Library
    const fetchResult = await fetchAdLibraryPage(url);

    if (!fetchResult.success) {
      console.error('Direct fetch failed:', fetchResult.error);

      await supabase.from('readings').insert({
        monitor_id,
        ads_active_count: 0,
        source_method: 'direct_fetch',
        status: 'error',
        error_message: fetchResult.error || 'Failed to fetch Ad Library page',
      });

      return new Response(
        JSON.stringify({ success: false, error: fetchResult.error || 'Failed to fetch page', ads_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = fetchResult.html;
    console.log('Fetched content length:', content.length);

    // Extract ads count
    const { count: adsCount, found: foundMatch } = extractAdsCount(content);

    // Anomaly detection
    let anomalyDetected = false;
    if (foundMatch && adsCount > 0 && isAnomalousSpike(adsCount, recentCounts)) {
      anomalyDetected = true;
      console.log(`SPIKE REJECTED: ${adsCount} is anomalous`);
    }

    const readingStatus = !foundMatch ? 'suspect' : anomalyDetected ? 'suspect' : 'ok';
    const errorMessage = !foundMatch
      ? 'Could not confidently extract ads count; defaulted to 0'
      : anomalyDetected
        ? `Anomalous spike detected: ${adsCount} vs recent median.`
        : null;

    console.log(`Final: monitor=${monitor_id}, count=${adsCount}, status=${readingStatus}, found=${foundMatch}, anomaly=${anomalyDetected}`);

    // Insert reading
    await supabase.from('readings').insert({
      monitor_id,
      ads_active_count: adsCount,
      source_method: 'direct_fetch',
      status: readingStatus,
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ads_count: adsCount,
        found_match: foundMatch,
        anomaly_detected: anomalyDetected,
        reading_status: readingStatus,
        source_method: 'direct_fetch',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in scrape-ad-library function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
