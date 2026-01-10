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

  // Pattern 1: Extract ad_archive_id from URLs
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

  // Pattern 2: Extract from data attributes
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

  // Pattern 3: Try to extract start dates from content
  const startDatePattern = /Started running on\s*([\w\s,]+\d{4})/gi;
  const dates: string[] = [];
  while ((match = startDatePattern.exec(markdownContent)) !== null) {
    dates.push(match[1].trim());
  }

  // Try alternative date patterns
  const altDatePattern = /(?:Começou a ser veiculado em|Em exibição desde)\s*([\d\/]+)/gi;
  while ((match = altDatePattern.exec(markdownContent)) !== null) {
    dates.push(match[1].trim());
  }

  // Assign dates to ads if we found matching counts
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

  // Pattern 4: Extract ad body text - look for common patterns
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

  // Pattern 5: Extract preview URLs
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

// Calculate days active based on ad_start_date
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

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Add cache-busting timestamp to URL to ensure fresh data
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

    // Extract total ads count
    let adsCount = 0;
    let foundMatch = false;

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
        adsCount = parseInt(match[1].replace(/[.,]/g, ''), 10);
        foundMatch = true;
        console.log(`Found via pattern: ${adsCount}`);
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
            console.log('Found via fallback:', adsCount);
            break;
          }
        }
      }
    }

    console.log(`Final ads count for monitor ${monitor_id}: ${adsCount}, found: ${foundMatch}`);

    // Insert reading
    const { data: readingData, error: insertError } = await supabase
      .from('readings')
      .insert({
        monitor_id,
        ads_active_count: adsCount,
        source_method: 'public_parse',
        status: foundMatch ? 'ok' : 'error',
        error_message: foundMatch ? null : 'Could not extract ads count from page',
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

        // Upsert ad details
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

      // Update last_seen and is_active for seen ads
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
