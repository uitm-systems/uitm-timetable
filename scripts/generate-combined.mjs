import { generateCombinedHtmlCalendar } from '../src/calendar_generator.mjs';
import fs from 'fs';
import path from 'path';

function run() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.log("Usage: node generate-combined.mjs <CAMPUS_CODE> <GROUP_CODE> <ACAD_GROUP> <SEMESTER_CODE>");
    console.log("Example: node generate-combined.mjs K KCDIM1445E B 20264");
    return;
  }

  const campusCode = args[0];
  const groupCode = args[1];
  const acadGroup = args[2];
  const semesterCode = args[3];

  console.log(`Generating combined calendar for Group ${groupCode} with Academic Sem ${semesterCode}...`);
  const html = generateCombinedHtmlCalendar(campusCode, groupCode, acadGroup, semesterCode);
  
  if (html.includes("No classes found")) {
    console.log("Warning: No classes found for that combination.");
  }

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outPath = path.join(outputDir, `${groupCode}_combined_calendar.html`);
  fs.writeFileSync(outPath, html);
  
  console.log(`✅ Success! Calendar generated at: ${outPath}`);
  console.log(`Open this file in your web browser to view the combined schedule.`);
}

run();
