/**
 * export-static-api.mjs
 * 
 * Reads the master SQLite database and exports aggregated, campus-level
 * JSON files for the static web frontend. Produces ~90 files instead of 12K+.
 * 
 * Output structure:
 *   web/public/api/
 *   ├── meta.json              { lastUpdated, semesterCode, totalClasses, ... }
 *   ├── campuses.json          [{ id, text }, ...]
 *   ├── courses/
 *   │   ├── A.json             [{ code, path }, ...]  (all courses for campus A)
 *   │   ├── K.json
 *   │   └── ...
 *   └── groups/
 *       ├── A.json             { "IML301": [...], "IML302": [...] }  (all groups for campus A)
 *       ├── K.json
 *       └── ...
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = 'db/timetable_v2.sqlite';
const OUT_DIR = 'web/public/api';

// Verify database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found at ${DB_PATH}. Run the scraper first.`);
  process.exit(1);
}

const db = new Database(DB_PATH);

// Create output directories
for (const dir of [OUT_DIR, path.join(OUT_DIR, 'courses'), path.join(OUT_DIR, 'groups')]) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log('Exporting Static API from SQLite...\n');

// ─── 1. Export campuses.json ─────────────────────────────────────────────────
const campuses = db.prepare(
  "SELECT code AS id, code || ' - ' || name AS text FROM campuses ORDER BY code"
).all();
fs.writeFileSync(path.join(OUT_DIR, 'campuses.json'), JSON.stringify(campuses));
console.log(`✅ campuses.json — ${campuses.length} campuses`);

// ─── 2. Export courses/<campus>.json ─────────────────────────────────────────
let totalCourseFiles = 0;
for (const campus of campuses) {
  const courses = db.prepare(`
    SELECT DISTINCT crs.code, ? || ':' || crs.code AS path
    FROM classes c
    JOIN courses crs ON c.course_id = crs.id
    WHERE c.campus_id = (SELECT id FROM campuses WHERE code = ?)
    ORDER BY crs.code
  `).all(campus.id, campus.id);

  if (courses.length > 0) {
    fs.writeFileSync(
      path.join(OUT_DIR, 'courses', `${campus.id}.json`),
      JSON.stringify(courses)
    );
    totalCourseFiles++;
  }
}
console.log(`✅ courses/ — ${totalCourseFiles} campus files`);

// ─── 3. Export groups/<campus>.json (aggregated) ─────────────────────────────

// Helper: convert 24h to 12h UiTM format
const to12h = (t) => {
  if (!t) return t;
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

// Pull entire timetable in one query (fast — single table scan of the view)
const allRows = db.prepare(`
  SELECT campus_code, course_code, group_code,
         day, day_index, start_time, end_time,
         mode, status, rooms, program_code, faculty_code
  FROM v_timetable
  ORDER BY campus_code, course_code, group_code, day_index, start_time
`).all();

// Group by campus → course
const campusData = {};
let totalClasses = 0;

for (const r of allRows) {
  totalClasses++;
  if (!campusData[r.campus_code]) campusData[r.campus_code] = {};
  if (!campusData[r.campus_code][r.course_code]) campusData[r.campus_code][r.course_code] = [];

  const dayTime = r.day && r.start_time && r.end_time
    ? `${r.day}( ${to12h(r.start_time)}-${to12h(r.end_time)} )`
    : r.day || '';

  campusData[r.campus_code][r.course_code].push({
    group: r.group_code,
    day_time: dayTime,
    mode: r.mode || '',
    status: r.status || '',
    room: r.rooms || '',
    program: r.program_code || '',
    faculty: r.faculty_code || '',
  });
}

// Write one aggregated file per campus
let totalGroupFiles = 0;
for (const [campusCode, courses] of Object.entries(campusData)) {
  fs.writeFileSync(
    path.join(OUT_DIR, 'groups', `${campusCode}.json`),
    JSON.stringify(courses)
  );
  totalGroupFiles++;
}
console.log(`✅ groups/ — ${totalGroupFiles} campus files (aggregated from ${totalClasses} class records)`);

// ─── 4. Generate meta.json ──────────────────────────────────────────────────
const meta = {
  lastUpdated: new Date().toISOString(),
  totalClasses,
  totalCampuses: campuses.length,
  totalCourseFiles,
  totalGroupFiles,
  scrapeVersion: 'v2',
};
fs.writeFileSync(path.join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`✅ meta.json — lastUpdated: ${meta.lastUpdated}`);

// ─── Summary ─────────────────────────────────────────────────────────────────
const totalFiles = 1 + 1 + totalCourseFiles + totalGroupFiles; // meta + campuses + courses + groups
console.log(`\n🎉 Static API exported: ${totalFiles} files total (was 12,220 before aggregation)`);

db.close();
