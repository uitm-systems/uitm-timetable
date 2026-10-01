# UiTM Timetable AI Agent Guide

Welcome, Agent! You are operating in the `uitm-timetable` capability module. This repository is dedicated to scraping, storing, and serving structured UiTM class timetables.

When the user asks you to **"look up a timetable," "what classes do I have,"** or **"query a schedule,"** this document provides you with the exact playbook on how to fulfill those requests swiftly and accurately.

---

## 1. The Database (`db/timetable_v2.sqlite`)
The core of this repository is a heavily normalized SQLite database located at `db/timetable_v2.sqlite`.

**DO NOT use the scraper to answer standard user queries.** The scraper takes several minutes to run. Instead, you should always **query the SQLite database directly** using Node.js (`better-sqlite3`) to answer user questions instantly.

### The Magic View: `v_timetable`
You do **not** need to write complex SQL joins to fetch a student's timetable. The database includes a pre-built view named `v_timetable` that flattens the entire schedule for you.

**Columns available in `v_timetable`:**
- `class_id`
- `campus_code` (e.g., `K`)
- `campus_name` (e.g., `SUNGAI PETANI`)
- `course_code` (e.g., `IML301`)
- `course_name` (Note: Modern iCress often omits this, so it may be `NULL`)
- `group_code` (e.g., `KCDIM2605A`)
- `program_code` (e.g., `CDIM260`)
- `faculty_code` (e.g., `IM`)
- `day` (e.g., `SUNDAY`)
- `day_index` (1=Sunday, 2=Monday... 7=Saturday - Use this to sort chronological weekly schedules!)
- `start_time` (24-hour format, e.g., `08:00`)
- `end_time` (24-hour format, e.g., `10:00`)
- `mode` (e.g., `Full-time and Blended Learning`)
- `status` (e.g., `Active`)
- `rooms` (e.g., `B14, BK104` - pre-aggregated as a comma-separated string)

### Example AI Agent Query Script
If a user says *"Generate calendar for Campus Sungai Petani, KCDIM2605A"*, you should dynamically generate and execute a Node script like this:

```javascript
// scratch_query.cjs
const Database = require('better-sqlite3');
const db = new Database('./db/timetable_v2.sqlite');

const rows = db.prepare(`
  SELECT day, start_time, end_time, course_code, mode, rooms 
  FROM v_timetable 
  WHERE campus_code = 'K' AND group_code = 'KCDIM2605A'
  ORDER BY day_index ASC, start_time ASC
`).all();

console.table(rows);
```
Once you get the output, neatly format the results into a Markdown schedule or HTML calendar for the user.

---

## 2. Scraping & Data Refresh
If the user explicitly asks you to **"refresh the database," "update the schedule,"** or **"run the scraper"**, follow these steps:

1. **Verify Playwright Requirements**: The scraper *must* use headed mode due to UiTM bot protection. (This is already configured in the code).
2. **Execute the Scraper**:
   ```bash
   node scripts/scrape-campus.mjs
   ```
   *(Note: The `scrape-campus.mjs` script currently defaults to Campus K. If the user asks for a different campus, you may need to pass the campus code to the script or modify the hardcoded `campusCode` constant).*
3. **Historical Data Handling**: You do not need to drop tables or manually delete old data. The `database.mjs` ORM uses a `session` tracker in the `scrape_runs` table that automatically performs cascading deletions of old records before cleanly inserting the new ones.

---

## 3. Strict 1:1 Mirror Policy
If you are tasked with debugging the scraper or the insertion logic in `src/database.mjs`, remember the **1:1 Mirror Policy**. 
Do not write code that tries to aggressively "clean" or "strip" prefixes from Group, Program, or Course codes. (e.g., If the portal says `KAA705`, save it exactly as `KAA705`. Do not strip the `K`). The data must be an exact historical representation of what the administrators typed into the portal.

---

## 4. Documentation
For deep-dive architectural rules regarding the junction tables, foreign keys, and indexes, please refer to:
[DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)

---

## 5. Advanced Timetable Analytics & Features

The database powers a suite of 14 advanced features. As an AI Agent, you can immediately fulfill complex user requests by importing and using the built-in functions from `src/queries.mjs`.

### Available Functions in `src/queries.mjs`:
When the user asks you to perform analysis, write a tiny scratch script that imports the necessary functions and execute it.

```javascript
import {
  getGroupSchedule, exportToIcs, generateWeeklyGrid,
  findCourse, findProgram, getFacultyCourses,
  getFreeRooms, getRoomUtilization, detectClashes,
  findFreeSlots, getBusiestDays, compareCampuses,
  getFacultyWorkload, getCampusSummary
} from './src/queries.mjs';
```

#### Supported Capabilities:
1. **`getGroupSchedule(campusCode, groupCode)`**: Fetches the raw schedule array for a student group.
2. **`exportToIcs(campusCode, groupCode)`**: Generates a downloadable `.ics` calendar string.
3. **`generateWeeklyGrid(campusCode, groupCode)`**: Returns a clean Markdown weekly grid.
4. **`findCourse(courseCode)`**: Returns a list of campuses offering a specific course.
5. **`findProgram(programCode)`**: Returns campuses offering a program.
6. **`getFacultyCourses(campusCode, facultyCode)`**: Lists courses taught by a faculty at a campus.
7. **`getFreeRooms(campusCode, day, startTime, endTime)`**: Finds empty rooms for ad-hoc meetings.
8. **`getRoomUtilization(campusCode)`**: Identifies the top 10 most booked rooms.
9. **`detectClashes(campusCode, groupCode)`**: Returns an array of overlapping classes for a group.
10. **`findFreeSlots(campusCode, groupCode)`**: Finds gaps (free time) between classes for a group.
11. **`getBusiestDays(campusCode)`**: Ranks days by the total number of scheduled classes.
12. **`compareCampuses(campusA, campusB)`**: Finds courses offered in Campus A but NOT in Campus B.
13. **`getFacultyWorkload(campusCode)`**: Ranks faculties by the number of classes they teach.
14. **`getCampusSummary()`**: Returns a high-level statistical dashboard of all campuses.
15. **`generateCombinedHtmlCalendar(campusCode, groupCode, acadGroup, semesterCode)`**: Generates an interactive HTML dashboard combining timetable and academic calendar data.

### 📅 Calendar Generator
The **Calendar Generator** is a powerful visual integration feature that combines raw timetable data from this repository with the academic calendar data from the sibling `uitm-academic-calendar` repository. 

It outputs a highly polished, interactive HTML dashboard (`<GROUP>_combined_calendar.html`) that features:
- **Academic Event Overlays**: Breaks, Final Exams, Revision Weeks, and weekly lecture blocks are superimposed on the schedule.
- **Smart Rendering**: Timetable classes automatically skip Mid-Semester Breaks and Holidays.
- **Interactive UI**: Course legend, sweetalert2 popup details, Dark/Light theme toggle, and a Print mode.
- **Google Calendar Export**: A direct `.ics` download button to export the schedule into Google/Apple/Outlook calendars.

**How to run it:**
You can invoke the Calendar Generator natively via the NPM script. It requires 4 arguments: Campus Code, Group Code, Academic Group (A or B), and the Academic Semester Code.

```bash
npm run calendar-generator K KCDIM1445E B 20264
```


## 6. Google Calendar Integration & Syncing

When writing scripts to sync timetable classes or academic events to Google Calendar:

1. **Event Titles:** Always format class event summaries as `[Course Code] - [Room]` (e.g., `IML302 - TEC1`) rather than appending the student group code.
2. **Academic Banners:** Include the following special academic calendar blocks as all-day, full-week background events (spanning Sunday to Saturday for Kedah, or Monday to Sunday otherwise):
   - Mid-Semester Break
   - Revision Week
   - Final Examination
   - Semester Break
3. **CRITICAL: The UTC Timezone Bug (Off-by-One Day):** When calculating dates for Google Calendar events in Malaysia (+08:00), **NEVER** use `new Date().toISOString()`. Because it converts to UTC, a local Sunday midnight becomes Saturday 4:00 PM UTC, causing events to shift back by one entire day in the calendar. Instead, use pure string-based local date math (e.g., parsing `YYYY-MM-DD` manually) and pass the naive local time strings to the API while explicitly setting `timeZone: 'Asia/Kuala_Lumpur'`.
4. **Auth Token Caching (dotenv):** When writing standalone Node.js scripts to push events using local `.env` tokens, always use `dotenv.config({ override: true })`. This prevents the script from failing with `invalid_grant` due to inheriting stale environment variables from the parent terminal or background daemon.

5. **Kedah Academic Calendar Day Shift:** The academic calendar source only includes Kedah-specific `*` notes for Lecture entries. For all OTHER entries (Mid-Semester Break, Revision Week, Final Exam, Semester Break), you MUST manually shift dates back by 1 day when the campus is Kedah (`K`), Kelantan (`J`), or Terengganu (`T`). These states use Sunday-Saturday weeks instead of Monday-Sunday.
6. **Year Typo Auto-Correction:** The academic calendar source data occasionally contains year typos (e.g., `2025` instead of `2026`). When parsing dates, derive the expected year range from the semester code (e.g., `20264` -> base year 2026). If a parsed year falls outside `[baseYear, baseYear+1]`, auto-correct it based on the month (Jul-Dec -> baseYear, Jan-Jun -> baseYear+1).
