import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db/timetable_v2.sqlite');

function getDb() {
  const db = new Database(dbPath);
  // Read-only connection for analytics
  db.pragma('journal_mode = WAL');
  return db;
}

// 1. Group schedule lookup
export function getGroupSchedule(campusCode, groupCode) {
  const db = getDb();
  return db.prepare(`
    SELECT day, start_time, end_time, course_code, mode, rooms, faculty_code
    FROM v_timetable 
    WHERE campus_code = ? AND group_code = ?
    ORDER BY day_index ASC, start_time ASC
  `).all(campusCode, groupCode);
}

// 2. Export to .ics calendar
export function exportToIcs(campusCode, groupCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UiTM Timetable//Agent//EN\n";
  const dayMap = {
    'SUNDAY': 'SU', 'MONDAY': 'MO', 'TUESDAY': 'TU', 'WEDNESDAY': 'WE', 
    'THURSDAY': 'TH', 'FRIDAY': 'FR', 'SATURDAY': 'SA'
  };
  
  schedule.forEach((cls, i) => {
    if (!cls.start_time || !cls.end_time || !cls.day) return;
    const startObj = cls.start_time.replace(':', '') + '00';
    const endObj = cls.end_time.replace(':', '') + '00';
    const rruleDay = dayMap[cls.day.toUpperCase()];
    
    ics += "BEGIN:VEVENT\n";
    ics += `SUMMARY:${cls.course_code}\n`;
    ics += `LOCATION:${cls.rooms || 'TBA'}\n`;
    ics += `DESCRIPTION:Mode: ${cls.mode}\\nFaculty: ${cls.faculty_code}\n`;
    // Dummy start date for the first week of semester, using standard ics format
    ics += `DTSTART;TZID=Asia/Kuala_Lumpur:20261001T${startObj}\n`;
    ics += `DTEND;TZID=Asia/Kuala_Lumpur:20261001T${endObj}\n`;
    if (rruleDay) ics += `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};COUNT=14\n`;
    ics += "END:VEVENT\n";
  });
  ics += "END:VCALENDAR";
  return ics;
}

// 3. Weekly view generator (Markdown)
export function generateWeeklyGrid(campusCode, groupCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  if (schedule.length === 0) return "No classes found.";
  
  let md = `### Weekly Schedule: ${groupCode} (${campusCode})\n\n`;
  md += `| Day | Time | Course | Room | Mode |\n`;
  md += `|---|---|---|---|---|\n`;
  
  schedule.forEach(c => {
    md += `| ${c.day} | ${c.start_time}-${c.end_time} | **${c.course_code}** | ${c.rooms || '-'} | ${c.mode} |\n`;
  });
  return md;
}

// 4. Course finder
export function findCourse(courseCode) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT campus_code, campus_name 
    FROM v_timetable 
    WHERE course_code = ? 
    ORDER BY campus_code
  `).all(courseCode);
}

// 5. Program finder
export function findProgram(programCode) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT campus_code, campus_name, faculty_code 
    FROM v_timetable 
    WHERE program_code = ? 
    ORDER BY campus_code
  `).all(programCode);
}

// 6. Faculty course listing
export function getFacultyCourses(campusCode, facultyCode) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT course_code, course_name 
    FROM v_timetable 
    WHERE campus_code = ? AND faculty_code = ?
    ORDER BY course_code
  `).all(campusCode, facultyCode);
}

// 7. Room availability (Find free rooms)
export function getFreeRooms(campusCode, day, startTime, endTime) {
  const db = getDb();
  return db.prepare(`
    SELECT r.name as room_name
    FROM rooms r
    JOIN campuses cmp ON r.campus_id = cmp.id
    WHERE cmp.code = ?
      AND r.id NOT IN (
        SELECT cr.room_id
        FROM class_rooms cr
        JOIN classes c ON cr.class_id = c.id
        WHERE c.campus_id = cmp.id
          AND c.day = ?
          AND (
            (c.start_time < ? AND c.end_time > ?) OR
            (c.start_time >= ? AND c.start_time < ?) OR
            (c.end_time > ? AND c.end_time <= ?)
          )
      )
    ORDER BY r.name
  `).all(campusCode, day, endTime, startTime, startTime, endTime, startTime, endTime);
}

// 8. Room utilization report (Top 10 most used rooms)
export function getRoomUtilization(campusCode) {
  const db = getDb();
  return db.prepare(`
    SELECT r.name, COUNT(cr.class_id) as total_classes_booked
    FROM rooms r
    JOIN campuses cmp ON r.campus_id = cmp.id
    JOIN class_rooms cr ON r.id = cr.room_id
    WHERE cmp.code = ?
    GROUP BY r.id
    ORDER BY total_classes_booked DESC
    LIMIT 10
  `).all(campusCode);
}

// 9. Clash detection
export function detectClashes(campusCode, groupCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  const clashes = [];
  
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      const c1 = schedule[i];
      const c2 = schedule[j];
      
      if (c1.day === c2.day) {
        if (c1.start_time < c2.end_time && c1.end_time > c2.start_time) {
          clashes.push({ class1: c1, class2: c2 });
        }
      }
    }
  }
  return clashes;
}

// 10. Free slot finder
export function findFreeSlots(campusCode, groupCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  const freeSlots = [];
  
  // Group by day
  const days = {};
  schedule.forEach(c => {
    if (!days[c.day]) days[c.day] = [];
    days[c.day].push(c);
  });
  
  for (const [day, classes] of Object.entries(days)) {
    // Sort by start time
    classes.sort((a, b) => a.start_time.localeCompare(b.start_time));
    
    for (let i = 0; i < classes.length - 1; i++) {
      const current = classes[i];
      const next = classes[i+1];
      
      if (current.end_time < next.start_time) {
        freeSlots.push({
          day: day,
          free_from: current.end_time,
          free_until: next.start_time
        });
      }
    }
  }
  return freeSlots;
}

// 11. Busiest day analysis
export function getBusiestDays(campusCode) {
  const db = getDb();
  return db.prepare(`
    SELECT day, COUNT(id) as total_classes
    FROM v_timetable
    WHERE campus_code = ? AND day IS NOT NULL
    GROUP BY day
    ORDER BY total_classes DESC
  `).all(campusCode);
}

// 12. Campus comparison (Courses offered in one but not another)
export function compareCampuses(campusA, campusB) {
  const db = getDb();
  // Find courses in A that are NOT in B
  return db.prepare(`
    SELECT DISTINCT course_code
    FROM v_timetable
    WHERE campus_code = ? 
      AND course_code NOT IN (
        SELECT DISTINCT course_code 
        FROM v_timetable 
        WHERE campus_code = ?
      )
  `).all(campusA, campusB);
}

// 13. Faculty workload
export function getFacultyWorkload(campusCode) {
  const db = getDb();
  return db.prepare(`
    SELECT faculty_code, COUNT(id) as class_count, COUNT(DISTINCT course_code) as course_count
    FROM v_timetable
    WHERE campus_code = ? AND faculty_code IS NOT NULL
    GROUP BY faculty_code
    ORDER BY class_count DESC
  `).all(campusCode);
}

// 14. Campus summary dashboard
export function getCampusSummary() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      campus_code, 
      campus_name, 
      COUNT(DISTINCT course_code) as unique_courses,
      COUNT(DISTINCT group_code) as total_groups,
      COUNT(id) as total_classes
    FROM v_timetable
    GROUP BY campus_code
    ORDER BY total_classes DESC
  `).all();
}



