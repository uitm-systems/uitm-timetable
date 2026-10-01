import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Load environment variables, overriding inherited ones to avoid stale tokens
const envPath = 'd:/Users/USER/Desktop/Me/Nash-Representative/.env.local';
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error("Usage: node scripts/gcal-sync.mjs <CAMPUS_CODE> <GROUP_CODE> <ACAD_GROUP> <SEMESTER_CODE>");
  console.error("Example: node scripts/gcal-sync.mjs K KCDIM1445E B 20264");
  process.exit(1);
}

const [campusCode, groupCode, acadGroup, semesterCode] = args;
const dbPath = path.resolve(process.cwd(), 'db/timetable_v2.sqlite');

// Date parser helper
function parseDateString(str) {
  // e.g. "27 September - 19 December 2026"
  // e.g. "21 - 27 December 2026"
  const cleanStr = str.replace(/\*|\[.*?\]/g, '').trim();
  const parts = cleanStr.split(/[-–]/);
  
  if (parts.length !== 2) return null;
  
  let endPart = parts[1].trim(); // "19 December 2026"
  let startPart = parts[0].trim(); // "27 September" or "21"
  
  const endMatch = endPart.match(/(\d+)\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (!endMatch) return null;
  
  const endDay = parseInt(endMatch[1], 10);
  const endMonth = endMatch[2];
  const year = parseInt(endMatch[3], 10);
  
  let startDay, startMonth;
  const startMatch = startPart.match(/(\d+)(?:\s+([a-zA-Z]+))?/i);
  if (startMatch) {
    startDay = parseInt(startMatch[1], 10);
    startMonth = startMatch[2] || endMonth;
  } else {
    return null;
  }
  
  const months = {
    'january':0, 'february':1, 'march':2, 'april':3, 'may':4, 'june':5,
    'july':6, 'august':7, 'september':8, 'october':9, 'november':10, 'december':11
  };
  
  const startDt = new Date(year, months[startMonth.toLowerCase()], startDay);
  const endDt = new Date(year, months[endMonth.toLowerCase()], endDay);
  
  // Handle cross-year parsing (e.g. 28 December - 10 January 2027)
  if (startDt > endDt) {
    startDt.setFullYear(year - 1);
  }
  
  // Auto-correct year typos in academic calendar data.
  // Derive the expected year range from the semester code (e.g. "20264" → base year 2026).
  const baseYear = parseInt(semesterCode.substring(0, 4), 10);
  if (baseYear && (startDt.getFullYear() < baseYear || startDt.getFullYear() > baseYear + 1)) {
    // Year is way off — correct it to the expected range
    const monthIdx = startDt.getMonth();
    // If month is in the later half of the year, it's likely the base year; 
    // if early, it's likely baseYear + 1
    const correctedYear = monthIdx >= 6 ? baseYear : baseYear + 1;
    startDt.setFullYear(correctedYear);
    endDt.setFullYear(endDt.getMonth() >= startDt.getMonth() ? correctedYear : correctedYear + 1);
    if (startDt > endDt) endDt.setFullYear(correctedYear + 1);
  }
  
  return { start: startDt, end: endDt };
}

function formatDate(dateObj) {
  const yy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return formatDate(dt);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  console.log(`\n--- Starting Google Calendar Sync for ${groupCode} ---`);
  
  // 1. Fetch Academic Calendar Dates
  console.log("Fetching academic calendar...");
  let acadData;
  try {
    const cmd = `node ../uitm-academic-calendar/tools/print_academic_calendar.js --group ${acadGroup} --semester-code ${semesterCode}`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    acadData = JSON.parse(output).results[0].semesters[0];
  } catch (e) {
    console.error("Failed to fetch academic calendar:", e.message);
    process.exit(1);
  }

  // Parse lecture blocks and mid-sem break
  let lectureStartStr = null;
  let midSemStartStr = null;
  let midSemEndStr = null;
  let totalLectureWeeks = 0;

  const isKedah = ['K', 'T', 'J'].includes(campusCode.toUpperCase());

  for (const entry of acadData.entries) {
    let dateRaw = entry.date;
    let usedKedahNote = false;
    if (isKedah && entry.notes && entry.notes.length > 0) {
      const kedahNote = entry.notes.find(n => n.startsWith('*'));
      if (kedahNote) {
        dateRaw = kedahNote;
        usedKedahNote = true;
      }
    }
    
    const parsed = parseDateString(dateRaw);
    if (!parsed) continue;

    // For Kedah: if no Kedah-specific note was found, shift dates back by 1 day
    // (Kedah weeks run Sun-Sat instead of Mon-Sun)
    if (isKedah && !usedKedahNote && entry.activity.toLowerCase() !== 'note') {
      parsed.start.setDate(parsed.start.getDate() - 1);
      parsed.end.setDate(parsed.end.getDate() - 1);
    }

    if (entry.activity.toLowerCase().includes('lecture')) {
      if (!lectureStartStr) {
        lectureStartStr = formatDate(parsed.start);
      }
      totalLectureWeeks += parseInt(entry.duration) || 0;
    }
    if (entry.activity.toLowerCase().includes('mid-semester break')) {
      midSemStartStr = formatDate(parsed.start);
      midSemEndStr = formatDate(parsed.end);
    }
  }

  if (!lectureStartStr) {
    console.error("Could not determine lecture start date.");
    process.exit(1);
  }

  console.log(`Lecture Start: ${lectureStartStr}`);
  console.log(`Mid-Sem Break: ${midSemStartStr} to ${midSemEndStr}`);
  console.log(`Total Lecture Weeks: ${totalLectureWeeks}`);

  // 2. Fetch Classes from Database
  console.log("Querying SQLite database...");
  const db = new Database(dbPath);
  const rows = db.prepare(`
    SELECT day, start_time, end_time, course_code, mode, rooms, faculty_code
    FROM v_timetable
    WHERE campus_code = ? AND group_code = ?
    ORDER BY day_index ASC, start_time ASC
  `).all(campusCode, groupCode);
  db.close();

  if (rows.length === 0) {
    console.error(`No classes found for ${groupCode} at Campus ${campusCode}.`);
    process.exit(1);
  }
  console.log(`Found ${rows.length} weekly class slots.`);

  // 3. Connect to Google Calendar
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

  // 4. Create or Find Dedicated Calendar
  console.log("Setting up 'UiTM Timetable' calendar...");
  let calendarId;
  const calList = await calendar.calendarList.list();
  const existingCal = calList.data.items.find(c => c.summary === 'UiTM Timetable');
  if (existingCal) {
    calendarId = existingCal.id;
    console.log(`Found existing calendar (ID: ${calendarId})`);
  } else {
    const created = await calendar.calendars.insert({
      requestBody: { summary: 'UiTM Timetable', timeZone: 'Asia/Kuala_Lumpur' }
    });
    calendarId = created.data.id;
    console.log(`Created new calendar (ID: ${calendarId})`);
  }

  // 5. Idempotent Cleanup (Delete existing tagged events in this calendar)
  console.log("Cleaning up old sync data...");
  try {
    const res = await calendar.events.list({
      calendarId,
      privateExtendedProperty: 'source=uitm-timetable',
      maxResults: 2500
    });
    
    if (res.data.items && res.data.items.length > 0) {
      console.log(`Deleting ${res.data.items.length} old events...`);
      for (const e of res.data.items) {
        await calendar.events.delete({ calendarId, eventId: e.id });
        process.stdout.write('x');
        await delay(50);
      }
      console.log("\nCleanup complete.");
    } else {
      console.log("No old events to clean.");
    }
  } catch (e) {
    console.error("Cleanup error:", e.message);
  }

  // 6. Push Events
  console.log("Pushing new events...");
  const dayMap = {
    'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3,
    'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
  };

  const uniqueCourses = [...new Set(rows.map(r => r.course_code))];
  const courseColors = {};
  uniqueCourses.forEach((course, i) => { courseColors[course] = String((i % 11) + 1); });

  let count = 0;
  
  // Calculate occurrences to skip for mid-sem break
  // For a weekly RRULE, we specify EXDATEs for the exact instances we want to skip.
  const exdates = [];
  if (midSemStartStr) {
    // If mid-sem break is 1 week, it's 7 days. We just need to add the dates within that week to exdates.
    // We will generate the 7 dates in YYYYMMDD format.
    for (let i = 0; i < 7; i++) {
      const d = addDays(midSemStartStr, i);
      exdates.push(d.replace(/-/g, ''));
    }
  }

  for (const cls of rows) {
    if (!cls.start_time || !cls.day) continue;
    const targetDayOffset = dayMap[cls.day.toUpperCase()];
    
    // Find the date of the FIRST occurrence of this class in Week 1
    const firstOccurrenceStr = addDays(lectureStartStr, targetDayOffset);
    const startTime = `${firstOccurrenceStr}T${cls.start_time}:00`;
    const endTime = `${firstOccurrenceStr}T${cls.end_time}:00`;
    
    // Construct EXDATE string for RRULE by appending the time to the dates
    const exdateLines = exdates.map(d => `${d}T${cls.start_time.replace(/:/g, '')}00Z`);
    // Note: EXDATE expects UTC if the DTSTART is UTC, but if we use local time, it expects local time without Z, but standard is tricky.
    // Actually, for timeZone bound events, EXDATE expects TZID:
    // e.g. EXDATE;TZID=Asia/Kuala_Lumpur:20261220T140000
    const exdateRule = exdates.length > 0 
      ? [`EXDATE;TZID=Asia/Kuala_Lumpur:${exdates.map(d => `${d}T${cls.start_time.replace(/:/g, '')}00`).join(',')}`] 
      : undefined;

    const rrule = [`RRULE:FREQ=WEEKLY;COUNT=${totalLectureWeeks + 1}`]; // +1 to account for the mid-sem break week being skipped

    const event = {
      summary: `${cls.course_code} - ${cls.rooms || 'TBA'}`,
      location: cls.rooms,
      description: `Mode: ${cls.mode}\nFaculty: ${cls.faculty_code}`,
      start: { dateTime: startTime, timeZone: 'Asia/Kuala_Lumpur' },
      end: { dateTime: endTime, timeZone: 'Asia/Kuala_Lumpur' },
      colorId: courseColors[cls.course_code],
      recurrence: exdateRule ? rrule.concat(exdateRule) : rrule,
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 15 }]
      },
      extendedProperties: {
        private: { source: 'uitm-timetable' }
      }
    };

    try {
      await calendar.events.insert({ calendarId, requestBody: event });
      count++;
      process.stdout.write('.');
    } catch (e) {
      console.error("\nFailed to insert", cls.course_code, e.message);
    }
    await delay(50);
  }

  console.log(`\nPushing academic banners...`);
  // Push WEEK 1..N banners
  let weekNum = 1;
  let currentWeekStart = lectureStartStr;
  for (let i = 0; i < totalLectureWeeks + 1; i++) {
    // If this week is inside the mid-sem break, skip incrementing the week number
    if (midSemStartStr && currentWeekStart >= midSemStartStr && currentWeekStart < midSemEndStr) {
      currentWeekStart = addDays(currentWeekStart, 7);
      continue;
    }
    const banner = {
      summary: `WEEK ${weekNum}`,
      start: { date: currentWeekStart },
      end: { date: addDays(currentWeekStart, 7) },
      colorId: "8",
      extendedProperties: { private: { source: 'uitm-timetable' } }
    };
    try {
      await calendar.events.insert({ calendarId, requestBody: banner });
      process.stdout.write('W');
    } catch (e) { }
    weekNum++;
    currentWeekStart = addDays(currentWeekStart, 7);
    await delay(50);
  }

  // Push special blocks
  for (const entry of acadData.entries) {
    let dateRaw = entry.date;
    let usedKedahNote = false;
    if (isKedah && entry.notes && entry.notes.length > 0) {
      const kedahNote = entry.notes.find(n => n.startsWith('*'));
      if (kedahNote) {
        dateRaw = kedahNote;
        usedKedahNote = true;
      }
    }
    const parsed = parseDateString(dateRaw);
    if (!parsed) continue;

    // Kedah shift: -1 day for entries without Kedah-specific notes
    if (isKedah && !usedKedahNote && entry.activity.toLowerCase() !== 'note') {
      parsed.start.setDate(parsed.start.getDate() - 1);
      parsed.end.setDate(parsed.end.getDate() - 1);
    }

    let colorId = '2'; // Default
    if (entry.activity.toLowerCase().includes('mid-sem')) colorId = '5';
    if (entry.activity.toLowerCase().includes('revision')) colorId = '6';
    if (entry.activity.toLowerCase().includes('final')) colorId = '11';
    
    // Skip normal lectures
    if (entry.activity.toLowerCase() === 'lecture') continue;

    const block = {
      summary: entry.activity,
      start: { date: formatDate(parsed.start) },
      end: { date: formatDate(new Date(parsed.end.getTime() + 86400000)) }, // exclusive end
      colorId,
      extendedProperties: { private: { source: 'uitm-timetable' } }
    };
    try {
      await calendar.events.insert({ calendarId, requestBody: block });
      process.stdout.write('S');
    } catch (e) { }
    await delay(50);
  }
  
  console.log(`\nSuccessfully created ${count} recurring class slots and banners in 'UiTM Timetable' calendar!`);
}

run();
