# UiTM Timetable Database (v2) - AI Agent Management Guide

This document provides a comprehensive guide to the `timetable_v2.sqlite` database schema, its relational structures, and the data sanitization rules required when interacting with or populating it.

## Overview
The database (`db/timetable_v2.sqlite`) stores scraped course scheduling data from the UiTM iCress portal. It is heavily normalized to ensure data integrity, eliminate duplicates, and handle the portal's occasionally messy string formats (e.g., merged codes, typographical errors).

## Schema & Tables

### 1. `branches`
- **Purpose**: Represents the major university branches (e.g., UiTM Kedah, UiTM Selangor).
- **Columns**: `id` (PK), `name` (UNIQUE).

### 2. `campuses`
- **Purpose**: Represents the specific campuses which fall under a branch (e.g., Sungai Petani Campus K under Kedah Branch).
- **Columns**: `id` (PK), `branch_id` (FK -> branches), `code` (UNIQUE), `name`.
- **Note**: When scraping, `branch_id` may initially be NULL if the branch mapping isn't explicitly known from the dropdown.

### 3. `faculties`
- **Purpose**: Represents academic faculties (e.g., IM for Information Management).
- **Columns**: `id` (PK), `code` (UNIQUE), `name` (TEXT).
- **Sanitization Rule**: The raw portal sometimes merges faculty codes with commas or semicolons (e.g. `AA,AB`). The scraper MUST split these and map classes to the primary code, or insert them separately. *(Note: `name` is currently `NULL` as `simsweb4` does not expose faculty names).*

### 4. `programs`
- **Purpose**: Academic programs (e.g., `CS240`, `KAA705`).
- **Columns**: `id` (PK), `code` (UNIQUE), `name` (TEXT), `faculty_id` (FK -> faculties).
- **Sanitization Rule**: 
  - Just like faculties, split multiple program codes by commas, semicolons, or whitespace. 
  - **1:1 Mirror Policy**: The raw data from iCress is preserved exactly as it was entered by administrators. This means if a local admin prefixed the program code with a campus identifier (e.g., `KAA705`), it is stored exactly as `KAA705` rather than stripped down to `AA705`. This preserves the true historical state of the portal data. *(Note: `name` is currently `NULL` as `simsweb4` does not expose program names).*

### 5. `groups`
- **Purpose**: Student class groups (e.g., `KCDIM2605A`).
- **Columns**: `id` (PK), `code` (UNIQUE), `program_id` (FK -> programs).

### 6. `courses`
- **Purpose**: Specific subjects/modules being taught (e.g., `IML301`).
- **Columns**: `id` (PK), `code` (UNIQUE), `name` (TEXT).
- **Missing Names Note**: The modern `simsweb4` portal does not reliably render human-readable course names (like "Information Behavior"). Because of this, the scraper leaves `name` as `NULL`. Future expansions should cross-reference a separate course directory to populate this field.

### 7. `rooms`
- **Purpose**: Physical or virtual locations (e.g., `B14`, `BK104`).
- **Columns**: `id` (PK), `campus_id` (FK -> campuses, NOT NULL), `name` (TEXT).
- **Sanitization Rule**: Split comma-separated rooms. The composite key `(campus_id, name)` is unique, ensuring room "B14" in Sungai Petani doesn't clash with "B14" in Shah Alam.

### 8. `scrape_runs`
- **Purpose**: Tracks the metadata and status of a scraping session.
- **Columns**: `id` (PK), `campus_id`, `session` (TEXT), `started_at`, `finished_at`, `total_courses`, `total_rows`, `status`.
- **Historical Strategy**: The scraper replaces old data for a given `campus_id` and `session` combination by executing `DELETE FROM scrape_runs WHERE campus_id = ? AND session = ?`. Since the foreign key to `classes` enforces `ON DELETE CASCADE`, this cleanly wipes the old snapshot before inserting the new one.

### 9. `classes`
- **Purpose**: The core fact table representing a single scheduled session of a course for a specific group.
- **Columns**: 
  - `id` (PK)
  - `scrape_run_id` (FK, `ON DELETE CASCADE`)
  - `campus_id` (FK)
  - `course_id` (FK)
  - `group_id` (FK)
  - `faculty_id` (FK) - Can be inferred via `group_id -> program_id -> faculty_id`.
  - `day` (TEXT, e.g., `SUNDAY`)
  - `day_index` (INTEGER, 1=Sunday, 2=Monday, etc.)
  - `start_time` (TEXT, 24h format e.g., `08:00`)
  - `end_time` (TEXT, 24h format e.g., `17:00`)
  - `mode` (TEXT)
  - `status` (TEXT)
  - `scraped_at` (TEXT)
- **Sanitization Rule**: 
  - The raw portal returns time as a single merged string (e.g., `SUNDAY( 08:00 AM-10:00 AM )`). The insertion script perfectly splits this into structured `day`, `start_time`, and `end_time` columns, explicitly converting the times into **24-hour format** (e.g. `13:00`) to enable correct temporal sorting via `ORDER BY` and `BETWEEN`. `day_index` is also injected to allow correct chronological sorting of the week.
  - `mode` & `status`: Fix common missing-space typos from the raw HTML (`Fulltimeand` -> `Full-time and`, `Timerand` -> `Timer and`).
- **Indexes**: Includes `idx_classes_day` to optimize day-filtered queries.

### 10. `class_rooms` (Junction Table)
- **Purpose**: Resolves the many-to-many relationship between a single class session and multiple rooms (e.g., when a class is listed as `BLENDED, KABIN 1`).
- **Columns**: `class_id` (FK, `ON DELETE CASCADE`), `room_id` (FK, `ON DELETE CASCADE`).
- **Primary Key**: Composite (`class_id`, `room_id`).
- **Indexes**: Features an index `idx_class_rooms_room` to optimize reverse lookups.
- **Sanitization Rule**: Never duplicate the `classes` row. Instead, split the raw comma-separated room string, ensure both rooms exist in the `rooms` table, and map both to the single `class_id` here.

### 11. `v_timetable` (View)
- **Purpose**: A convenience flat view that joins `classes` with `campuses`, `courses`, `groups`, `programs`, `faculties`, and `rooms`. 
- **Notes**: Because classes can have multiple rooms, the view uses `GROUP_CONCAT(r.name, ', ') AS rooms` to safely maintain a flat 1:1 mapping with the `classes` table without fan-out duplication.

## Data Population Pipeline (For AI Agents)

Whenever populating or updating the database, agents must adhere strictly to `src/database.mjs` which acts as the intelligent ORM. 

1. **Getter/Creator Functions**: Always use `getOrCreateCampus()`, `getOrCreateProgram()`, etc., instead of raw SQL inserts. These functions contain `try/catch` fallbacks to handle race conditions with SQLite's UNIQUE constraints gracefully without crashing.
2. **Scraper Extraction (`scraper.mjs`)**: Extracts text precisely from the DataTables output on iCress.
3. **Database Insertion (`database.mjs`)**: Responsible for applying the text sanitizations, stripping prefixes, generating junction records, and ensuring strict referential integrity.

## Null Handling & Inference
If `faculty_id` is missing when a class is initially parsed, it can be mathematically backfilled by joining the relationships upward:
```sql
UPDATE classes
SET faculty_id = (
  SELECT p.faculty_id FROM groups g
  JOIN programs p ON g.program_id = p.id
  WHERE g.id = classes.group_id
) WHERE faculty_id IS NULL;
```
Note: University Co-curriculum subjects (e.g. `HBU111`) legitimately have `NULL` faculty IDs as they are institution-wide.
