import { initSession, fetchCourseList, fetchClassDetails, delay, fetchFacultyList } from '../src/scraper.mjs';
import * as db from '../src/database.mjs';

function parseArgs() {
  const args = process.argv.slice(2);
  let campusCode = 'K';
  let campusName = 'SUNGAI PETANI';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--campus' && args[i+1]) {
      campusCode = args[i+1];
      i++;
    } else if (args[i] === '--name' && args[i+1]) {
      campusName = args[i+1];
      i++;
    }
  }
  return { campusCode, campusName };
}

async function run() {
  const { campusCode, campusName } = parseArgs();

  console.log(`Starting normalized scrape run for ${campusName} (${campusCode})...`);
  
  // Normalize campus
  const campusId = db.getOrCreateCampus(campusCode, campusName);
  
  // Hardcode current session, could be passed via args later
  const currentSession = '2026/2027-1';
  const runId = db.startScrapeRun(campusId, currentSession);

  try {
    const { client, hiddenTokens, submitUrl } = await initSession();
    
    console.log('Fetching course list...');
    let courses = [];
    
    if (campusCode === 'B') {
      console.log('Campus B detected. Fetching faculties...');
      const faculties = await fetchFacultyList(client);
      console.log(`Found ${faculties.length} faculties for Campus B.`);
      
      const courseMap = new Map();
      for (const fac of faculties) {
        console.log(`Fetching courses for faculty ${fac.code}...`);
        try {
          const facCourses = await fetchCourseList(client, `B_${fac.code}`, hiddenTokens, submitUrl);
          for (const c of facCourses) {
            if (!courseMap.has(c.code)) {
              courseMap.set(c.code, c);
            }
          }
        } catch(e) {
          console.error(`Failed to fetch faculty ${fac.code}: ${e.message}`);
        }
        await delay(500);
      }
      courses = Array.from(courseMap.values());
    } else {
      courses = await fetchCourseList(client, campusCode, hiddenTokens, submitUrl);
    }
    
    console.log(`Found ${courses.length} courses.`);

    let totalClassRows = 0;

    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      process.stdout.write(`\r  [${i + 1}/${courses.length}] Scraping ${course.code}          `);
      
      const courseId = db.getOrCreateCourse(course.code, course.name);
      
      let retries = 3;
      let classes = [];
      while (retries > 0) {
        try {
          classes = await fetchClassDetails(client, course.href);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
             console.error(`\nFailed to fetch ${course.code}: ${err.message}`);
          } else {
             await delay(500);
          }
        }
      }

      for (const cls of classes) {
        // Normalize related entities
        const facultyId = db.getOrCreateFaculty(cls.faculty);
        const programId = db.getOrCreateProgram(cls.program, facultyId);
        const groupId = db.getOrCreateGroup(cls.group_code, programId);

        db.insertClass(runId, campusId, courseId, groupId, facultyId, cls);
      }
      totalClassRows += classes.length;

      await delay(400); // polite rate limit
    }

    console.log(`\nScrape completed! Total classes inserted: ${totalClassRows}`);
    db.finishScrapeRun(runId, courses.length, totalClassRows, 'completed');

  } catch (err) {
    console.error('\nScrape failed:', err);
    db.finishScrapeRun(runId, 0, 0, 'failed');
  }
}

run();

