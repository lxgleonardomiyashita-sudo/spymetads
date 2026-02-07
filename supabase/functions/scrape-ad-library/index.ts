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

interface ExtractedAd {
  ad_archive_id: string;
  ad_start_date: string | null;
  ad_body: string | null;
  ad_title: string | null;
  preview_url: string | null;
  link_url: string | null;
  platforms: string[];
}

// Extract individual ads from the HTML content
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

  const altDatePattern = /(?:Começou a ser veiculado em|Em exibição desde)\s*([\d\/]+)/gi;
  while ((match = altDatePattern.exec(markdownContent)) !== null) {
    dates.push(match[1].trim());
  }

  if (dates.length > 0) {
    ads.forEach((ad, index) => {
      if (dates[index]) {
        try {
          const dateStr = dates[index];
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            ad.ad_start_date = parsed.toISOString();
          }
        } catch {
          // Ignore parse errors
        }
      }
    });
  }

  const bodyPatterns = [
    /"body":\s*\{[^}]*"text":\s*"([^"]+)"/gi,
    /"message":\s*"([^"]{20,500})"/gi,
  ];

  const bodies: string[] = [];
  for (const pattern of bodyPatterns) {
    while ((match = pattern.exec(htmlContent)) !== null) {
      bodies.push(match[1]);
    }
  }

  bodies.forEach((body, index) => {
    if (ads[index]) {
      ads[index].ad_body = body.slice(0, 500);
    }
  });

  const previewPattern = /(?:image|thumbnail|preview)[^"]*":\s*"(https:\/\/[^"]+)"/gi;
  const previews: string[] = [];
  while ((match = previewPattern.exec(htmlContent)) !== null) {
    previews.push(match[1]);
  }

  previews.forEach((preview, index) => {
    if (ads[index]) {
      ads[index].preview_url = preview;
    }
  });

  console.log(`Extracted ${ads.length} individual ads from content`);
  return ads;
}

function calculateDaysActive(startDate: string | null): number {
  if (!startDate) return 0;
  try {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

/**
 * Detect if a new count is an anomalous spike compared to recent history.
 * Returns true if the count looks like a false positive (e.g., lifetime total instead of active count).
 * 
 * IMPROVED: Also detects "steady-state contamination" where the same high value
 * has been repeated many times (indicating it was never the real active count).
 */
function isAnomalousSpike(newCount: number, recentCounts: number[]): boolean {
  if (recentCounts.length < 2) return false;
  if (newCount === 0) return false;
  
  // RULE 1: Absolute threshold — any single reading > 10,000 is suspicious
  // Real active ad counts rarely exceed this for individual advertisers
  if (newCount > 10000) {
    console.log(`ANOMALY DETECTED (absolute threshold): ${newCount} exceeds 10,000 limit`);
    return true;
  }

  // RULE 2: Steady-state contamination — if the same high value repeats in most recent readings,
  // it's likely a historical total that was incorrectly scraped repeatedly
  const sameValueCount = recentCounts.filter(c => c === newCount).length;
  if (sameValueCount >= 3 && newCount > 500) {
    console.log(`ANOMALY DETECTED (steady-state): ${newCount} appeared ${sameValueCount} times in last ${recentCounts.length} readings`);
    return true;
  }

  // RULE 3: Spike vs baseline — compare against recent valid counts
  const validCounts = recentCounts.filter(c => c > 0 && c < 10000);
  if (validCounts.length === 0) {
    // All recent readings were 0 or suspect, any large number is suspicious
    return newCount > 100;
  }

  const sorted = [...validCounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const maxRecent = Math.max(...validCounts);

  const spikeRatio = newCount / median;
  const maxRatio = newCount / maxRecent;

  if (spikeRatio > 10 && maxRatio > 5) {
    console.log(`ANOMALY DETECTED (spike): new=${newCount}, median=${median}, max=${maxRecent}, spikeRatio=${spikeRatio.toFixed(1)}, maxRatio=${maxRatio.toFixed(1)}`);
    return true;
  }

  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase credentials not configured');
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

    // Fetch recent readings for anomaly detection (last 10 ok readings)
    const { data: recentReadings } = await supabase
      .from('readings')
      .select('ads_active_count')
      .eq('monitor_id', monitor_id)
      .eq('status', 'ok')
      .order('timestamp', { ascending: false })
      .limit(10);

    const recentCounts = (recentReadings || []).map(r => r.ads_active_count);
    console.log(`Recent counts for anomaly check: [${recentCounts.join(', ')}]`);

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const cacheBuster = Date.now();
    const urlWithCacheBuster = formattedUrl.includes('?') 
      ? `${formattedUrl}&_cb=${cacheBuster}` 
      : `${formattedUrl}?_cb=${cacheBuster}`;

    console.log(`Scraping with cache-busting URL: ${urlWithCacheBuster}`);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: urlWithCacheBuster,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 8000,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl scrape failed:', scrapeData);
      
      await supabase.from('readings').insert({
        monitor_id,
        ads_active_count: 0,
        source_method: 'public_parse',
        status: 'error',
        error_message: scrapeData.error || `Scrape failed with status ${scrapeResponse.status}`,
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: scrapeData.error || 'Scrape failed',
          ads_count: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdownContent = scrapeData.data?.markdown || '';
    const htmlContent = scrapeData.data?.html || '';
    const content = markdownContent || htmlContent;
    
    console.log('Scraped content length:', content.length);

    // === STEP 1: Extract ads count ===
    let adsCount = 0;
    let foundMatch = false;
    let anomalyDetected = false;

    // Strong signal for 0 ads (override any numeric noise)
    const zeroPatterns = [
      /\bno\s+results\b/i,
      /\bnenhum\s+resultado\b/i,
      /\bnenhum\s+an[úu]ncio\b/i,
      /\bn[ãa]o\s+h[áa]\s+an[úu]ncios\b/i,
      /\b0\s*(?:results?|resultados?|ads?|an[úu]ncios?)\b/i,
      /\bno\s+ads\b/i,
    ];

    const zeroDetected = zeroPatterns.some((p) => p.test(content));
    if (zeroDetected) {
      adsCount = 0;
      foundMatch = true;
      console.log('Detected zero ads message in page content');
    }

    // EXCLUSION patterns: numbers that appear in historical/total context (NOT active ads)
    // These patterns identify text that should NOT be used for active ad counts
    const exclusionPatterns = [
      // "ran 39,308 ads" / "veiculou 39.308 anúncios" / "publicou X anúncios"
      /(?:ran|veiculou|publicou|total\s+(?:of|de))\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|an[úu]ncios?)/gi,
      // "39,308 ads ran" / "39.308 anúncios veiculados"
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:total\s+)?(?:ads?|an[úu]ncios?)\s*(?:ran|veiculad|publicad|in\s+total|no\s+total)/gi,
      // "This Page ran 39,308 ads" / "Esta Página veiculou 39.308 anúncios"
      /(?:this\s+page|esta\s+p[áa]gina)\s+.*?(\d{1,3}(?:[.,]\d{3})*)/gi,
      // "Page transparency" section often contains historical totals
      /(?:page\s+transparency|transpar[êe]ncia)\s+.*?(\d{1,3}(?:[.,]\d{3})*)/gi,
      // "About this Page" section — "This Page has run ads about..."
      /(?:about\s+this\s+page|sobre\s+esta\s+p[áa]gina)[\s\S]*?(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|an[úu]ncios?)/gi,
      // Generic "X ads from this page" pattern
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?\s+from|an[úu]ncios?\s+d[ea])\s+(?:this|esta)/gi,
    ];

    // Extract numbers that should be excluded (historical totals)
    const excludedNumbers = new Set<number>();
    for (const pattern of exclusionPatterns) {
      let exMatch;
      while ((exMatch = pattern.exec(content)) !== null) {
        const num = parseInt(exMatch[1].replace(/[.,]/g, ''), 10);
        excludedNumbers.add(num);
        console.log(`Excluding historical number: ${num}`);
      }
    }

    // Active ad count patterns (ordered by specificity)
    const patterns = [
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:results?|resultados?)/i,
      /(?:about|cerca de|approximately|aprox\.?)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?)/i,
      /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?|anuncios?)/i,
      /(?:showing|mostrando|displaying).*?(\d{1,3}(?:[.,]\d{3})*)/i,
      /(?:showing|mostrando)\s*\d+\s*(?:of|de)\s*(\d{1,3}(?:[.,]\d{3})*)/i,
    ];

    if (!zeroDetected) {
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          const candidate = parseInt(match[1].replace(/[.,]/g, ''), 10);
          
          // Skip if this number was identified as a historical total
          if (excludedNumbers.has(candidate)) {
            console.log(`Skipping excluded historical number: ${candidate}`);
            continue;
          }

          adsCount = candidate;
          foundMatch = true;
          console.log(`Found via pattern: ${adsCount}`);
          break;
        }
      }
    }

    if (!foundMatch) {
      console.log(`No confident ads count found for monitor ${monitor_id}, defaulting to 0`);
      adsCount = 0;
    }

    // === STEP 2: Anomaly / spike detection ===
    // Even if the pattern matched "ok", check if the value makes sense vs recent history
    if (foundMatch && adsCount > 0 && isAnomalousSpike(adsCount, recentCounts)) {
      anomalyDetected = true;
      console.log(`SPIKE REJECTED: ${adsCount} is anomalous compared to recent history [${recentCounts.join(', ')}]`);
      // Don't trust this reading — mark suspect and keep the extracted count for auditing
    }

    const readingStatus = !foundMatch ? 'suspect' 
      : anomalyDetected ? 'suspect' 
      : 'ok';
    
    const errorMessage = !foundMatch 
      ? 'Could not confidently extract ads count; defaulted to 0'
      : anomalyDetected 
        ? `Anomalous spike detected: ${adsCount} vs recent median. Likely historical total, not active count.`
        : null;

    console.log(`Final ads count for monitor ${monitor_id}: ${adsCount}, status: ${readingStatus}, found: ${foundMatch}, anomaly: ${anomalyDetected}`);

    // Insert reading
    const { data: readingData, error: insertError } = await supabase
      .from('readings')
      .insert({
        monitor_id,
        ads_active_count: adsCount,
        source_method: 'public_parse',
        status: readingStatus,
        error_message: errorMessage,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting reading:', insertError);
    }

    // Extract individual ads and save to ad_details
    const extractedAds = extractAdsFromContent(htmlContent, markdownContent);
    let savedAdsCount = 0;

    if (extractedAds.length > 0) {
      const now = new Date().toISOString();

      for (const ad of extractedAds) {
        const daysActive = calculateDaysActive(ad.ad_start_date);

        const { error: upsertError } = await supabase
          .from('ad_details')
          .upsert(
            {
              monitor_id,
              ad_archive_id: ad.ad_archive_id,
              ad_start_date: ad.ad_start_date,
              ad_body: ad.ad_body,
              ad_title: ad.ad_title,
              preview_url: ad.preview_url,
              link_url: ad.link_url,
              platforms: ad.platforms,
              days_active: daysActive,
              is_active: true,
              last_seen_at: now,
              updated_at: now,
            },
            {
              onConflict: 'monitor_id,ad_archive_id',
              ignoreDuplicates: false,
            }
          );

        if (upsertError) {
          console.error(`Error upserting ad ${ad.ad_archive_id}:`, upsertError);
        } else {
          savedAdsCount++;
        }
      }

      const adIds = extractedAds.map(a => a.ad_archive_id);
      await supabase
        .from('ad_details')
        .update({ 
          last_seen_at: now,
          is_active: true,
        })
        .eq('monitor_id', monitor_id)
        .in('ad_archive_id', adIds);

      console.log(`Saved ${savedAdsCount} ad details for monitor ${monitor_id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ads_count: adsCount,
        found_match: foundMatch,
        anomaly_detected: anomalyDetected,
        reading_status: readingStatus,
        source_method: 'public_parse',
        extracted_ads: extractedAds.length,
        saved_ads: savedAdsCount,
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
