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

serve(async (req) => {
  // Handle CORS preflight requests
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

  // Create Supabase client with service role for inserting readings
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

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Use Firecrawl to scrape the page
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: false,
        waitFor: 5000, // Wait 5 seconds for dynamic content
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl scrape failed:', scrapeData);
      
      // Record failed reading
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

    // Extract the ads count from the scraped content
    const content = scrapeData.data?.markdown || scrapeData.data?.html || '';
    const htmlContent = scrapeData.data?.html || '';
    
    console.log('Scraped content length:', content.length);

    // Try multiple patterns to find the ads count
    let adsCount = 0;
    let foundMatch = false;

    // Pattern 1: Look for "X results" or "X resultados"
    const resultsPattern = /(\d{1,3}(?:[.,]\d{3})*)\s*(?:results?|resultados?)/i;
    const resultsMatch = content.match(resultsPattern);
    if (resultsMatch) {
      adsCount = parseInt(resultsMatch[1].replace(/[.,]/g, ''), 10);
      foundMatch = true;
      console.log('Found via results pattern:', adsCount);
    }

    // Pattern 2: Look for "About X ads" or "Cerca de X anúncios"
    if (!foundMatch) {
      const aboutAdsPattern = /(?:about|cerca de|approximately|aprox\.?)\s*(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?)/i;
      const aboutMatch = content.match(aboutAdsPattern);
      if (aboutMatch) {
        adsCount = parseInt(aboutMatch[1].replace(/[.,]/g, ''), 10);
        foundMatch = true;
        console.log('Found via about ads pattern:', adsCount);
      }
    }

    // Pattern 3: Look for number followed by "ads" in various formats
    if (!foundMatch) {
      const adsPattern = /(\d{1,3}(?:[.,]\d{3})*)\s*(?:ads?|anúncios?|anuncios?)/i;
      const adsMatch = content.match(adsPattern);
      if (adsMatch) {
        adsCount = parseInt(adsMatch[1].replace(/[.,]/g, ''), 10);
        foundMatch = true;
        console.log('Found via ads pattern:', adsCount);
      }
    }

    // Pattern 4: Look in HTML for specific Meta Ad Library elements
    if (!foundMatch && htmlContent) {
      // Try to find the count in aria-labels or specific divs
      const htmlCountPattern = /(?:showing|mostrando|displaying).*?(\d{1,3}(?:[.,]\d{3})*)/i;
      const htmlMatch = htmlContent.match(htmlCountPattern);
      if (htmlMatch) {
        adsCount = parseInt(htmlMatch[1].replace(/[.,]/g, ''), 10);
        foundMatch = true;
        console.log('Found via HTML pattern:', adsCount);
      }
    }

    // Pattern 5: Look for "Showing X of Y" pattern
    if (!foundMatch) {
      const showingPattern = /(?:showing|mostrando)\s*\d+\s*(?:of|de)\s*(\d{1,3}(?:[.,]\d{3})*)/i;
      const showingMatch = content.match(showingPattern);
      if (showingMatch) {
        adsCount = parseInt(showingMatch[1].replace(/[.,]/g, ''), 10);
        foundMatch = true;
        console.log('Found via showing pattern:', adsCount);
      }
    }

    // Pattern 6: Generic large number in content (fallback - less reliable)
    if (!foundMatch) {
      const allNumbers = content.match(/\d{1,3}(?:[.,]\d{3})+|\d{4,}/g);
      if (allNumbers && allNumbers.length > 0) {
        // Take the first reasonably sized number that could be an ads count
        for (const numStr of allNumbers) {
          const num = parseInt(numStr.replace(/[.,]/g, ''), 10);
          if (num >= 1 && num <= 10000000) { // Reasonable range for ads count
            adsCount = num;
            foundMatch = true;
            console.log('Found via fallback number pattern:', adsCount);
            break;
          }
        }
      }
    }

    console.log(`Final ads count for monitor ${monitor_id}: ${adsCount}, found: ${foundMatch}`);

    // Record the reading in the database
    const { error: insertError } = await supabase.from('readings').insert({
      monitor_id,
      ads_active_count: adsCount,
      source_method: 'public_parse',
      status: foundMatch ? 'ok' : 'error',
      error_message: foundMatch ? null : 'Could not extract ads count from page',
    });

    if (insertError) {
      console.error('Error inserting reading:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ads_count: adsCount,
        found_match: foundMatch,
        source_method: 'public_parse',
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
