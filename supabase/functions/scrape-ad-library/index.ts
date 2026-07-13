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
  allow_firecrawl_fallback?: boolean;
}

interface FetchResult {
  content: string;
  success: boolean;
  sourceMethod: 'direct_fetch' | 'firecrawl';
  error?: string;
  statusCode?: number;
}

type DbSourceMethod = 'api' | 'public_parse';

function mapSourceMethodToDb(sourceMethod: FetchResult['sourceMethod']): DbSourceMethod {
  // readings.source_method currently accepts only: api | public_parse
  return sourceMethod === 'firecrawl' ? 'api' : 'public_parse';
}

function normalizeAdLibraryUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());

    if (["web.facebook.com", "m.facebook.com", "mbasic.facebook.com"].includes(parsed.hostname)) {
      parsed.hostname = "www.facebook.com";
    }

    parsed.protocol = "https:";
    parsed.searchParams.delete("_cb");

    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Fetch Facebook Ad Library page directly.
 */
async function fetchDirectAdLibraryPage(url: string): Promise<FetchResult> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  ];

  let lastStatusCode: number | undefined;
  let lastError = 'All direct fetch attempts failed';

  for (const ua of userAgents) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        redirect: 'follow',
      });

      lastStatusCode = response.status;

      if (!response.ok) {
        lastError = `Direct fetch failed with status ${response.status}`;
        console.log(`${lastError}, trying next strategy...`);
        continue;
      }

      const html = await response.text();

      if (html.length < 500) {
        lastError = `Direct fetch returned short payload (${html.length} chars)`;
        console.log(`${lastError}, trying next strategy...`);
        continue;
      }

      console.log(`Direct fetch succeeded (${html.length} chars)`);
      return { content: html, success: true, sourceMethod: 'direct_fetch' };
    } catch (error) {
      lastError = `Direct fetch exception: ${error instanceof Error ? error.message : 'unknown'}`;
      console.log(lastError);
    }
  }

  return {
    content: '',
    success: false,
    sourceMethod: 'direct_fetch',
    error: lastError,
    statusCode: lastStatusCode,
  };
}

/**
 * Fallback fetch via Firecrawl when direct fetch is blocked.
 */
async function fetchWithFirecrawl(url: string): Promise<FetchResult> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlApiKey) {
    return {
      content: '',
      success: false,
      sourceMethod: 'firecrawl',
      error: 'Firecrawl fallback unavailable (FIRECRAWL_API_KEY not configured)',
    };
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 1500,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiError = payload?.error || payload?.message || `Firecrawl failed with status ${response.status}`;
      return {
        content: '',
        success: false,
        sourceMethod: 'firecrawl',
        error: String(apiError),
        statusCode: response.status,
      };
    }

    const markdown = payload?.data?.markdown || payload?.markdown || '';
    const html = payload?.data?.html || payload?.html || '';
    const content = `${markdown}\n${html}`.trim();

    if (!content) {
      return {
        content: '',
        success: false,
        sourceMethod: 'firecrawl',
        error: 'Firecrawl returned empty content',
      };
    }

    console.log(`Firecrawl fallback succeeded (${content.length} chars)`);
    return {
      content,
      success: true,
      sourceMethod: 'firecrawl',
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      sourceMethod: 'firecrawl',
      error: `Firecrawl fallback exception: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
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

interface ExtractedAd {
  ad_archive_id: string;
  collation_count: number;
  ad_title: string | null;
  ad_body: string | null;
  link_url: string | null;
  ad_start_date: string | null;
  is_active: boolean;
  platforms: string[] | null;
}

/** Decode \uXXXX and \/ escapes found in embedded JSON strings. */
function decodeJsonString(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extract individual ads (with collation/repetition counts) from the
 * Ad Library page's embedded JSON. Best-effort: Facebook's markup changes
 * over time, so every field is optional except the archive id.
 */
function extractAdDetails(content: string): ExtractedAd[] {
  const byId = new Map<string, ExtractedAd>();
  const idPattern = /"(?:adArchiveID|ad_archive_id)"\s*:\s*"?(\d{6,})"?/g;

  let match;
  while ((match = idPattern.exec(content)) !== null) {
    const id = match[1];
    // Janela de contexto ao redor do id para capturar os campos do mesmo anuncio
    const win = content.slice(match.index, match.index + 4000);

    const collation = win.match(/"(?:collationCount|collation_count)"\s*:\s*(\d+)/);
    const title = win.match(/"title"\s*:\s*"((?:[^"\\]|\\.){2,300}?)"/);
    const body = win.match(/"(?:body"\s*:\s*\{\s*"markup"\s*:\s*\{\s*"__html|body)"\s*:\s*"((?:[^"\\]|\\.){2,1000}?)"/);
    const link = win.match(/"(?:linkUrl|link_url)"\s*:\s*"((?:[^"\\]|\\.)+?)"/);
    const start = win.match(/"(?:startDate|start_date)"\s*:\s*(\d{9,13})/);
    const active = win.match(/"(?:isActive|is_active)"\s*:\s*(true|false)/);
    const platforms = win.match(/"(?:publisherPlatform|publisher_platform)"\s*:\s*\[([^\]]*)\]/);

    const startMs = start ? parseInt(start[1], 10) * (start[1].length <= 10 ? 1000 : 1) : null;

    const ad: ExtractedAd = {
      ad_archive_id: id,
      collation_count: collation ? Math.max(1, parseInt(collation[1], 10)) : 1,
      ad_title: title ? decodeJsonString(title[1]).slice(0, 300) : null,
      ad_body: body ? decodeJsonString(body[1]).slice(0, 1000) : null,
      link_url: link ? decodeJsonString(link[1]).slice(0, 500) : null,
      ad_start_date: startMs ? new Date(startMs).toISOString() : null,
      is_active: active ? active[1] === 'true' : true,
      platforms: platforms
        ? platforms[1].split(',').map(p => decodeJsonString(p.replace(/"/g, ''))).filter(Boolean)
        : null,
    };

    const existing = byId.get(id);
    if (!existing || ad.collation_count > existing.collation_count) {
      byId.set(id, {
        ...ad,
        ad_title: ad.ad_title ?? existing?.ad_title ?? null,
        ad_body: ad.ad_body ?? existing?.ad_body ?? null,
        link_url: ad.link_url ?? existing?.link_url ?? null,
        ad_start_date: ad.ad_start_date ?? existing?.ad_start_date ?? null,
      });
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.collation_count - a.collation_count)
    .slice(0, 200);
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
    const { monitor_id, url, allow_firecrawl_fallback = false }: ScrapeRequest = await req.json();

    if (!monitor_id || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'monitor_id and url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeAdLibraryUrl(url);
    console.log(`Scraping Ad Library URL for monitor ${monitor_id}: ${normalizedUrl}`);

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

    let fetchResult = await fetchDirectAdLibraryPage(normalizedUrl);

    const shouldTryFirecrawlFallback =
      allow_firecrawl_fallback &&
      !fetchResult.success &&
      [403, 429].includes(fetchResult.statusCode ?? 0);

    if (shouldTryFirecrawlFallback) {
      console.log('Direct fetch blocked, trying Firecrawl fallback...');
      const firecrawlResult = await fetchWithFirecrawl(normalizedUrl);
      if (firecrawlResult.success) {
        fetchResult = firecrawlResult;
      } else {
        fetchResult.error = `${fetchResult.error || 'Direct fetch failed'} | ${firecrawlResult.error || 'Firecrawl fallback failed'}`;
      }
    }

    if (!fetchResult.success) {
      console.error('Fetch failed:', fetchResult.error);

      const { error: insertError } = await supabase.from('readings').insert({
        monitor_id,
        ads_active_count: 0,
        source_method: mapSourceMethodToDb(fetchResult.sourceMethod),
        status: 'error',
        error_message: fetchResult.error || 'Failed to fetch Ad Library page',
      });

      if (insertError) {
        console.error('Failed to persist error reading:', insertError);
        return new Response(
          JSON.stringify({
            success: false,
            error: `Falha ao salvar leitura de erro: ${insertError.message}`,
            ads_count: 0,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: fetchResult.error || 'Failed to fetch page', ads_count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = fetchResult.content;
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

    const { error: insertError } = await supabase.from('readings').insert({
      monitor_id,
      ads_active_count: adsCount,
      source_method: mapSourceMethodToDb(fetchResult.sourceMethod),
      status: readingStatus,
      error_message: errorMessage,
    });

    if (insertError) {
      console.error('Failed to persist reading:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Falha ao salvar leitura: ${insertError.message}`,
          ads_count: adsCount,
          reading_status: readingStatus,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Best-effort: extrai anuncios individuais (com repeticoes) e salva em ad_details.
    // Nunca derruba a leitura principal se falhar.
    let adsExtracted = 0;
    try {
      const ads = extractAdDetails(content);
      adsExtracted = ads.length;
      console.log(`Extracted ${ads.length} individual ads`);

      if (ads.length > 0) {
        const now = new Date().toISOString();
        const rows = ads.map(ad => ({
          monitor_id,
          ad_archive_id: ad.ad_archive_id,
          collation_count: ad.collation_count,
          ad_title: ad.ad_title,
          ad_body: ad.ad_body,
          link_url: ad.link_url,
          ad_start_date: ad.ad_start_date,
          is_active: ad.is_active,
          platforms: ad.platforms,
          last_seen_at: now,
          days_active: ad.ad_start_date
            ? Math.max(0, Math.floor((Date.now() - new Date(ad.ad_start_date).getTime()) / 86400000))
            : 0,
        }));

        const { error: adsError } = await supabase
          .from('ad_details')
          .upsert(rows, { onConflict: 'monitor_id,ad_archive_id' });

        if (adsError) {
          console.error('Failed to upsert ad_details:', adsError);
        }
      }
    } catch (adErr) {
      console.error('Ad details extraction failed (non-fatal):', adErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ads_count: adsCount,
        found_match: foundMatch,
        anomaly_detected: anomalyDetected,
        reading_status: readingStatus,
        source_method: fetchResult.sourceMethod,
        ads_extracted: adsExtracted,
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
