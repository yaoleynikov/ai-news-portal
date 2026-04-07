import Parser from 'rss-parser';
import { supabase } from '../config.js';

const parser = new Parser();

// Curated list of high-value IT/AI feeds
const FEEDS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/frontpage' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
];

async function runGatekeeper() {
  console.log('[GATEKEEPER] Starting RSS Feed Scrape Cycle...');
  
  // Self-Healing: Reset crashed/stuck worker jobs (processing for > 15 mins)
  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60000).toISOString();
    const { data: stuck } = await supabase
      .from('jobs')
      .update({ status: 'pending' })
      .eq('status', 'processing')
      .lte('created_at', fifteenMinsAgo)
      .select();
      
    if (stuck && stuck.length > 0) {
      console.log(`[GATEKEEPER] Recovered ${stuck.length} stuck jobs.`);
    }
  } catch(e) {
    console.error('[GATEKEEPER] Retry recovery failed:', e.message);
  }

  for (const feed of FEEDS) {
    try {
      console.log(`[GATEKEEPER] Fetching ${feed.name}...`);
      const parsed = await parser.parseURL(feed.url);
      
      // Only process the latest 5 items per run to avoid flooding the seq queue
      const latestItems = parsed.items.slice(0, 5); 
      
      for (const item of latestItems) {
        // We use an ON CONFLICT DO NOTHING trick in SQL for the unique source_url index.
        const { error } = await supabase
          .from('jobs')
          .insert({
            url: item.link,
            source_name: feed.name,
            status: 'pending'
          });

        if (!error) {
          console.log(`[GATEKEEPER] NEW JOB: Enqueued ${item.link}`);
        } else if (error.code !== '23505') { // Ignore unique constraint violations (already in queue/db)
          console.error(`[GATEKEEPER] DB Error for ${item.link}:`, error.message);
        }
      }
    } catch (err) {
      console.error(`[GATEKEEPER] Failed fetching ${feed.name}:`, err.message);
    }
  }

  console.log('[GATEKEEPER] Cycle Complete.');
}

// Allow direct execution
if (process.argv[1] && process.argv[1].endsWith('cron.js')) {
  runGatekeeper().then(() => process.exit(0));
}

export { runGatekeeper };
