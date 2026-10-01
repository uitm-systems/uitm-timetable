import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db/timetable_v2.sqlite');

if (fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
  } catch (e) {
    fs.renameSync(dbPath, dbPath + '.' + Date.now() + '.bak');
  }
}

console.log(`Initializing normalized database at ${dbPath}...`);
const db = new Database(dbPath);

db.exec(`
CREATE TABLE branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE campuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    branch_id INTEGER,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(branch_id) REFERENCES branches(id)
);

CREATE TABLE faculties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT
);

CREATE TABLE programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT,
    faculty_id INTEGER,
    FOREIGN KEY(faculty_id) REFERENCES faculties(id)
);

CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    program_id INTEGER,
    FOREIGN KEY(program_id) REFERENCES programs(id)
);

CREATE TABLE courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT
);

CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(campus_id, name),
    FOREIGN KEY(campus_id) REFERENCES campuses(id)
);

CREATE TABLE scrape_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campus_id INTEGER NOT NULL,
    session TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    total_courses INTEGER DEFAULT 0,
    total_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    FOREIGN KEY(campus_id) REFERENCES campuses(id)
);

CREATE TABLE classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scrape_run_id INTEGER NOT NULL,
    campus_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    faculty_id INTEGER,
    day TEXT,
    day_index INTEGER,
    start_time TEXT,
    end_time TEXT,
    mode TEXT,
    status TEXT,
    scraped_at TEXT NOT NULL,
    FOREIGN KEY(scrape_run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(campus_id) REFERENCES campuses(id),
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(group_id) REFERENCES groups(id),
    FOREIGN KEY(faculty_id) REFERENCES faculties(id)
);

CREATE TABLE class_rooms (
    class_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    PRIMARY KEY (class_id, room_id),
    FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_classes_course ON classes(course_id);
CREATE INDEX idx_classes_group ON classes(group_id);
CREATE INDEX idx_classes_campus ON classes(campus_id);
CREATE INDEX idx_classes_day ON classes(day);
CREATE INDEX idx_groups_program ON groups(program_id);
CREATE INDEX idx_programs_faculty ON programs(faculty_id);
CREATE INDEX idx_class_rooms_room ON class_rooms(room_id);

-- Views
CREATE VIEW v_timetable AS
SELECT 
    c.id AS class_id,
    cmp.code AS campus_code,
    cmp.name AS campus_name,
    crs.code AS course_code,
    crs.name AS course_name,
    g.code AS group_code,
    p.code AS program_code,
    f.code AS faculty_code,
    c.day,
    c.day_index,
    c.start_time,
    c.end_time,
    c.mode,
    c.status,
    GROUP_CONCAT(r.name, ', ') AS rooms
FROM classes c
JOIN campuses cmp ON c.campus_id = cmp.id
JOIN courses crs ON c.course_id = crs.id
JOIN groups g ON c.group_id = g.id
LEFT JOIN programs p ON g.program_id = p.id
LEFT JOIN faculties f ON p.faculty_id = f.id
LEFT JOIN class_rooms cr ON c.id = cr.class_id
LEFT JOIN rooms r ON cr.room_id = r.id
GROUP BY c.id;

INSERT INTO branches (name) VALUES 
('Johor'), ('Kedah'), ('Kelantan'), ('Melaka'), ('Negeri Sembilan'), 
('Pahang'), ('Perak'), ('Perlis'), ('Pulau Pinang'), ('Sabah'), 
('Sarawak'), ('Selangor'), ('Terengganu'), ('W.P. Kuala Lumpur'), ('Shah Alam');
`);

console.log('Database initialized successfully.');
db.close();
