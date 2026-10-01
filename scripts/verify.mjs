import Database from 'better-sqlite3';
const db = new Database('./db/timetable_v2.sqlite');

console.log('--- Database Stats ---');
console.log('Courses:', db.prepare('SELECT COUNT(*) as c FROM courses').get().c);
console.log('Groups:', db.prepare('SELECT COUNT(*) as c FROM groups').get().c);
console.log('Programs:', db.prepare('SELECT COUNT(*) as c FROM programs').get().c);
console.log('Faculties:', db.prepare('SELECT COUNT(*) as c FROM faculties').get().c);
console.log('Classes:', db.prepare('SELECT COUNT(*) as c FROM classes').get().c);

console.log('\n--- Normalized Query for KCDIM1445E ---');
const query = db.prepare(`
  SELECT 
    c.code as course,
    cl.day_time,
    cl.room,
    g.code as group_code,
    p.code as program,
    f.code as faculty
  FROM classes cl
  JOIN courses c ON cl.course_id = c.id
  JOIN groups g ON cl.group_id = g.id
  JOIN programs p ON g.program_id = p.id
  JOIN faculties f ON p.faculty_id = f.id
  WHERE g.code = 'KCDIM1445E'
`).all();

console.table(query);
