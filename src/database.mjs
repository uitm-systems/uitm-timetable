import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db/timetable_v2.sqlite');

let db;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function getOrCreate(table, column, value, extraCol = null, extraVal = null) {
  if (!value) return null;
  const db = getDb();
  let row = db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(value);
  if (!row) {
    if (extraCol !== null && extraVal !== null) {
      const stmt = db.prepare(`INSERT INTO ${table} (${column}, ${extraCol}) VALUES (?, ?)`);
      try {
        row = { id: stmt.run(value, extraVal).lastInsertRowid };
      } catch(e) {
        row = db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(value);
      }
    } else {
      const stmt = db.prepare(`INSERT INTO ${table} (${column}) VALUES (?)`);
      try {
        row = { id: stmt.run(value).lastInsertRowid };
      } catch (e) {
        row = db.prepare(`SELECT id FROM ${table} WHERE ${column} = ?`).get(value);
      }
    }
  }
  return row.id;
}

export function getOrCreateCampus(code, name) {
  const db = getDb();
  code = code.trim();
  name = name.trim();
  let row = db.prepare(`SELECT id FROM campuses WHERE code = ?`).get(code);
  
  if (!row) {
    // Map branch
    let branchId = null;
    const branches = db.prepare(`SELECT id, name FROM branches`).all();
    // basic mapping
    const branchMapping = {
      'SUNGAI PETANI': 'Kedah',
      'SHAH ALAM': 'Shah Alam',
      'KUANTAN': 'Pahang',
      'JENGKA': 'Pahang',
      'RAUB': 'Pahang',
      'MACHANG': 'Kelantan',
      'KOTA BHARU': 'Kelantan',
      'SEGAMAT': 'Johor',
      'PASIR GUDANG': 'Johor',
      'ALOR GAJAH': 'Melaka',
      'BANDARAYA MELAKA': 'Melaka',
      'JASIN': 'Melaka',
      'KUALA PILAH': 'Negeri Sembilan',
      'SEREMBAN': 'Negeri Sembilan',
      'REMBAU': 'Negeri Sembilan',
      'BUKIT MERTAJAM': 'Pulau Pinang',
      'BERTAM': 'Pulau Pinang',
      'PERMATANG PAUH': 'Pulau Pinang',
      'SAMARAHAN': 'Sarawak',
      'MUKAH': 'Sarawak',
      'ARAU': 'Perlis',
      'KOTA KINABALU': 'Sabah',
      'TAWAU': 'Sabah',
      'DUNGUN': 'Terengganu',
      'BUKIT BESI': 'Terengganu',
      'KUALA TERENGGANU': 'Terengganu',
      'SERI ISKANDAR': 'Perak',
      'TAPAH': 'Perak',
      'PUNCAK ALAM': 'Selangor',
      'PUNCAK PERDANA': 'Selangor',
      'KUALA LUMPUR': 'W.P. Kuala Lumpur',
      'BAITULMAL': 'W.P. Kuala Lumpur'
    };
    let branchName = null;
    for (const [key, val] of Object.entries(branchMapping)) {
      if (name.toUpperCase().includes(key)) {
        branchName = val;
        break;
      }
    }
    
    // Check if Selangor Campus
    if (name.toUpperCase().includes('SELANGOR CAMPUS')) {
      branchName = 'Selangor';
    }
    if (name.toUpperCase().includes('SHAH ALAM')) {
      branchName = 'Shah Alam';
    }

    if (branchName) {
      const bRow = branches.find(b => b.name === branchName);
      if (bRow) branchId = bRow.id;
    }
    
    const stmt = db.prepare(`INSERT INTO campuses (code, name, branch_id) VALUES (?, ?, ?)`);
    try {
      row = { id: stmt.run(code, name, branchId).lastInsertRowid };
    } catch(e) {
      row = db.prepare(`SELECT id FROM campuses WHERE code = ?`).get(code);
    }
  } else {
    // Optionally update branch if missing
    const current = db.prepare(`SELECT branch_id FROM campuses WHERE id = ?`).get(row.id);
    if (!current.branch_id) {
      // do the mapping
      let branchId = null;
      const branches = db.prepare(`SELECT id, name FROM branches`).all();
      const branchMapping = {
        'SUNGAI PETANI': 'Kedah', 'SHAH ALAM': 'Shah Alam', 'KUANTAN': 'Pahang',
        'JENGKA': 'Pahang', 'RAUB': 'Pahang', 'MACHANG': 'Kelantan',
        'KOTA BHARU': 'Kelantan', 'SEGAMAT': 'Johor', 'PASIR GUDANG': 'Johor',
        'ALOR GAJAH': 'Melaka', 'BANDARAYA MELAKA': 'Melaka', 'JASIN': 'Melaka',
        'KUALA PILAH': 'Negeri Sembilan', 'SEREMBAN': 'Negeri Sembilan',
        'REMBAU': 'Negeri Sembilan', 'BUKIT MERTAJAM': 'Pulau Pinang',
        'BERTAM': 'Pulau Pinang', 'PERMATANG PAUH': 'Pulau Pinang',
        'SAMARAHAN': 'Sarawak', 'MUKAH': 'Sarawak', 'ARAU': 'Perlis',
        'KOTA KINABALU': 'Sabah', 'TAWAU': 'Sabah', 'DUNGUN': 'Terengganu',
        'BUKIT BESI': 'Terengganu', 'KUALA TERENGGANU': 'Terengganu',
        'SERI ISKANDAR': 'Perak', 'TAPAH': 'Perak', 'PUNCAK ALAM': 'Selangor',
        'PUNCAK PERDANA': 'Selangor', 'KUALA LUMPUR': 'W.P. Kuala Lumpur',
        'BAITULMAL': 'W.P. Kuala Lumpur'
      };
      let branchName = null;
      for (const [key, val] of Object.entries(branchMapping)) {
        if (name.toUpperCase().includes(key)) {
          branchName = val;
          break;
        }
      }
      if (name.toUpperCase().includes('SELANGOR CAMPUS')) branchName = 'Selangor';
      if (name.toUpperCase().includes('SHAH ALAM')) branchName = 'Shah Alam';
      if (branchName) {
        const bRow = branches.find(b => b.name === branchName);
        if (bRow) {
          db.prepare(`UPDATE campuses SET branch_id = ? WHERE id = ?`).run(bRow.id, row.id);
        }
      }
    }
  }
  return row.id;
}

export function getOrCreateFaculty(rawCode) {
  if (!rawCode) return null;
  // Use the first code if multiple exist
  const code = rawCode.split(/[,;\s]+/)[0].trim();
  if (!code) return null;
  return getOrCreate('faculties', 'code', code);
}

export function getOrCreateProgram(rawCode, facultyId) {
  if (!rawCode) return null;
  let code = rawCode.split(/[,;\s]+/)[0].trim();
  if (!code) return null;
  
  // Strict 1:1 mirror: keeping raw data exactly as scraped (including campus prefixes if they exist)
  
  return getOrCreate('programs', 'code', code, 'faculty_id', facultyId);
}

export function getOrCreateGroup(code, programId) {
  if (!code) return null;
  return getOrCreate('groups', 'code', code.trim(), 'program_id', programId);
}

export function getOrCreateCourse(code, name = null) {
  if (!code) return null;
  return getOrCreate('courses', 'code', code.trim(), name ? 'name' : null, name ? name.trim() : null);
}

export function getOrCreateRoom(roomName, campusId) {
  if (!roomName || !campusId) return null;
  const db = getDb();
  let row = db.prepare(`SELECT id FROM rooms WHERE campus_id = ? AND name = ?`).get(campusId, roomName.trim());
  if (!row) {
    const stmt = db.prepare(`INSERT INTO rooms (campus_id, name) VALUES (?, ?)`);
    try {
      row = { id: stmt.run(campusId, roomName.trim()).lastInsertRowid };
    } catch(e) {
      row = db.prepare(`SELECT id FROM rooms WHERE campus_id = ? AND name = ?`).get(campusId, roomName.trim());
    }
  }
  return row ? row.id : null;
}

export function startScrapeRun(campusId, sessionStr = null) {
  const db = getDb();
  
  // Historical Strategy: Replace old data for this campus + session combination
  // If sessionStr is provided, delete old scrape_runs for this campus & session.
  // Because classes.scrape_run_id has ON DELETE CASCADE, this clears old classes and class_rooms!
  if (sessionStr) {
    db.prepare(`DELETE FROM scrape_runs WHERE campus_id = ? AND session = ?`).run(campusId, sessionStr);
  } else {
    // If no session provided, maybe clear all for campus? Or just leave it?
    // Let's clear all for this campus if no session is defined, to fulfill "old data replaced" globally if session unused
    db.prepare(`DELETE FROM scrape_runs WHERE campus_id = ? AND session IS NULL`).run(campusId);
  }

  const stmt = db.prepare(`
    INSERT INTO scrape_runs (campus_id, session, started_at, status)
    VALUES (?, ?, ?, 'running')
  `);
  return stmt.run(campusId, sessionStr, new Date().toISOString()).lastInsertRowid;
}

export function finishScrapeRun(runId, totalCourses, totalRows, status = 'completed') {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE scrape_runs
    SET finished_at = ?, total_courses = ?, total_rows = ?, status = ?
    WHERE id = ?
  `);
  stmt.run(new Date().toISOString(), totalCourses, totalRows, status, runId);
}

export function insertClass(runId, campusId, courseId, groupId, facultyId, cls) {
  const db = getDb();
  
  // Clean typography
  let mode = (cls.mode || '').trim().replace('Fulltimeand', 'Full-time and');
  let status = (cls.status || '').trim().replace('Timerand', 'Timer and');
  
  // Parse day_time into day, start_time, end_time
  // e.g. "SUNDAY( 08:00 AM-10:00 AM )"
  let rawTime = (cls.day_time || '').trim();
  let day = null, start_time = null, end_time = null, day_index = null;
  const timeMatch = rawTime.match(/^([A-Z]+)\s*\(\s*([\d: APM]+?)\s*-\s*([\d: APM]+?)\s*\)/i);
  
  function to24h(t) {
    if (!t) return t;
    const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return t;
    let h = parseInt(match[1], 10);
    let m = match[2];
    let ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  const dayIndexMap = {
    'SUNDAY': 1, 'MONDAY': 2, 'TUESDAY': 3, 'WEDNESDAY': 4,
    'THURSDAY': 5, 'FRIDAY': 6, 'SATURDAY': 7
  };

  if (timeMatch) {
    day = timeMatch[1].toUpperCase();
    day_index = dayIndexMap[day] || null;
    start_time = to24h(timeMatch[2].trim());
    end_time = to24h(timeMatch[3].trim());
  } else {
    day = rawTime;
    day_index = dayIndexMap[day.toUpperCase()] || null;
  }
    
  const stmt = db.prepare(`
    INSERT INTO classes (
      scrape_run_id, campus_id, course_id, group_id, faculty_id,
      day, day_index, start_time, end_time, mode, status, scraped_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const classId = stmt.run(
    runId, campusId, courseId, groupId, facultyId,
    day, day_index, start_time, end_time, mode, status,
    new Date().toISOString()
  ).lastInsertRowid;
  
  // Map rooms
  if (cls.room) {
    const roomNames = cls.room.split(',').map(r => r.trim()).filter(Boolean);
    const insertClassRoom = db.prepare("INSERT OR IGNORE INTO class_rooms (class_id, room_id) VALUES (?, ?)");
    for (const rName of roomNames) {
      const roomId = getOrCreateRoom(rName, campusId);
      if (roomId) {
        insertClassRoom.run(classId, roomId);
      }
    }
  }
}
