/**
 * refresh-all.mjs
 *
 * Unified pipeline: Scrape → Verify → Export → Git Push → (Optional) GCal Sync
 *
 * Usage:
 *   npm run refresh                   # Full pipeline (scrape + export + push)
 *   npm run refresh -- --skip-scrape  # Export + push only (use existing DB)
 *   npm run refresh -- --skip-push    # Scrape + export only (no git push)
 *   npm run refresh -- --with-gcal    # Also sync Google Calendar
 */

import { execSync } from 'child_process';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, 'db', 'timetable_v2.sqlite');
const args = process.argv.slice(2);

const skipScrape = args.includes('--skip-scrape');
const skipPush = args.includes('--skip-push');
const withGcal = args.includes('--with-gcal');

function run(cmd, label) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log(`${'═'.repeat(60)}\n`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`\n❌ Failed: ${label}`);
    console.error(err.message);
    return false;
  }
}

// ─── Step 1: Scrape ──────────────────────────────────────────────────────────
if (!skipScrape) {
  const ok = run('node scripts/scrape-campus.mjs', 'Step 1/4: Scraping iCress → SQLite');
  if (!ok) {
    console.error('\n🛑 Scrape failed. Aborting pipeline.');
    process.exit(1);
  }
} else {
  console.log('\n⏭  Skipping scrape (--skip-scrape)');
}

// ─── Step 2: Verify Data Integrity ──────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('▶ Step 2/4: Verifying data integrity');
console.log(`${'═'.repeat(60)}\n`);

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found at ${DB_PATH}. Cannot continue.`);
  process.exit(1);
}

const db = new Database(DB_PATH);
const { n: classCount } = db.prepare('SELECT COUNT(*) AS n FROM classes').get();
const { n: campusCount } = db.prepare('SELECT COUNT(*) AS n FROM campuses').get();
db.close();

console.log(`   Classes: ${classCount.toLocaleString()}`);
console.log(`   Campuses: ${campusCount}`);

if (classCount < 1000) {
  console.error(`\n❌ Data looks incomplete (only ${classCount} classes). Aborting export.`);
  console.error('   Expected at least 1,000 classes. The scraper may have failed midway.');
  process.exit(1);
}

console.log('   ✅ Data integrity check passed.');

// ─── Step 3: Export Static API ───────────────────────────────────────────────
const ok3 = run('node scripts/export-static-api.mjs', 'Step 3/4: Exporting SQLite → Static JSON');
if (!ok3) {
  console.error('\n🛑 Export failed. Aborting pipeline.');
  process.exit(1);
}

// ─── Step 4: Git Commit + Push ───────────────────────────────────────────────
if (!skipPush) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('▶ Step 4/4: Git commit + push');
  console.log(`${'═'.repeat(60)}\n`);

  try {
    execSync('git add web/public/api/', { cwd: ROOT, stdio: 'inherit' });

    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    const msg = `data: update timetable data (${classCount.toLocaleString()} classes) — ${timestamp}`;
    execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT, stdio: 'inherit' });

    console.log('   ✅ Pushed to GitHub. Vercel will auto-deploy.');
  } catch (err) {
    // git commit exits with code 1 if nothing to commit — that's OK
    if (err.message.includes('nothing to commit')) {
      console.log('   ℹ  No data changes detected. Nothing to push.');
    } else {
      console.error(`   ⚠  Git push failed: ${err.message}`);
      console.error('   You can manually push later with: git push');
    }
  }
} else {
  console.log('\n⏭  Skipping git push (--skip-push)');
}

// ─── Optional: Google Calendar Sync ──────────────────────────────────────────
if (withGcal) {
  run('node scripts/gcal-sync.mjs', 'Optional: Syncing Google Calendar');
}

// ─── Done ────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log('🎉 Refresh pipeline complete!');
console.log(`${'═'.repeat(60)}`);
console.log(`   Classes in DB: ${classCount.toLocaleString()}`);
console.log(`   Campuses: ${campusCount}`);
if (!skipPush) console.log('   Vercel deployment: triggered');
if (withGcal) console.log('   Google Calendar: synced');
console.log('');
