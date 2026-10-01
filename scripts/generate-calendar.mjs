import { generateHtmlCalendar } from '../src/calendar_generator.mjs';
import fs from 'fs';
import path from 'path';

function run() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node generate-calendar.mjs <CAMPUS_CODE> <GROUP_CODE>");
    console.log("Example: node generate-calendar.mjs K KCDIM1442E");
    return;
  }

  const campusCode = args[0];
  const groupCode = args[1];

  console.log(`Generating calendar for Campus ${campusCode}, Group ${groupCode}...`);
  const html = generateHtmlCalendar(campusCode, groupCode);
  
  if (html.includes("No classes found")) {
    console.log("Warning: No classes found for that combination.");
  }

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outPath = path.join(outputDir, `${groupCode}_calendar.html`);
  fs.writeFileSync(outPath, html);
  
  console.log(`✅ Success! Calendar generated at: ${outPath}`);
  console.log(`Open this file in your web browser to view the monthly schedule.`);
}

run();
