import { initSession, fetchCampusList } from '../src/scraper.mjs';
import { execSync } from 'child_process';
import { getDb } from '../src/database.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runAll() {
  console.log('Initializing session for master scrape...');
  const { client } = await initSession();
  
  console.log('Fetching campus list...');
  const campuses = await fetchCampusList(client);
  
  console.log(`Found ${campuses.length} campuses to scrape.`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const campus of campuses) {
    console.log(`\n======================================================`);
    console.log(`Starting scrape for ${campus.name} (${campus.code})`);
    console.log(`======================================================`);
    
    try {
      // Execute the scrape-campus.mjs script for this specific campus
      execSync(`node "${join(__dirname, 'scrape-campus.mjs')}" --campus "${campus.code}" --name "${campus.name}"`, {
        stdio: 'inherit'
      });
      successCount++;
    } catch (err) {
      console.error(`\nFailed to scrape campus ${campus.code}. Continuing to next...`);
      failCount++;
    }
  }
  
  console.log(`\n======================================================`);
  console.log(`Scraping Complete!`);
  console.log(`Successfully scraped: ${successCount} campuses`);
  console.log(`Failed to scrape: ${failCount} campuses`);
  
  console.log('\nFinal Database Verification:');
  const db = getDb();
  const rows = db.prepare(`
    SELECT cmp.code, cmp.name, COUNT(DISTINCT c.course_id) as total_courses, COUNT(c.id) as total_classes 
    FROM classes c 
    JOIN campuses cmp ON c.campus_id = cmp.id 
    GROUP BY cmp.id 
    ORDER BY total_classes DESC
  `).all();
  
  console.table(rows);
}

runAll();
