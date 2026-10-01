import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { getGroupSchedule } from './queries.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Standalone HTML Monthly Calendar
export function generateHtmlCalendar(campusCode, groupCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  if (schedule.length === 0) return "<h1>No classes found.</h1>";

  const courses = [...new Set(schedule.map(c => c.course_code))];
  const colors = [
    '#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8E24AA', 
    '#F6BF26', '#039BE5', '#3F51B5', '#009688', '#795548'
  ];
  const courseColors = {};
  courses.forEach((course, i) => {
    courseColors[course] = colors[i % colors.length];
  });

  const events = [];
  const dayMap = {
    'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 
    'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6
  };

  // Generate recurring events for 14 weeks starting from a dummy date (e.g. 2026-10-04 is a Sunday)
  const baseDate = new Date('2026-10-04T00:00:00');
  
  schedule.forEach(cls => {
    if (!cls.start_time || !cls.day) return;
    const targetDayIndex = dayMap[cls.day.toUpperCase()];
    
    // Find the first date matching the day of the week
    const firstDate = new Date(baseDate);
    while (firstDate.getDay() !== targetDayIndex) {
      firstDate.setDate(firstDate.getDate() + 1);
    }

    const startSplit = cls.start_time.split(':');
    const endSplit = cls.end_time.split(':');

    // Create 14 weeks of events
    for (let week = 0; week < 14; week++) {
      const eventStart = new Date(firstDate);
      eventStart.setDate(eventStart.getDate() + (week * 7));
      eventStart.setHours(parseInt(startSplit[0]), parseInt(startSplit[1]), 0);
      
      const eventEnd = new Date(firstDate);
      eventEnd.setDate(eventEnd.getDate() + (week * 7));
      eventEnd.setHours(parseInt(endSplit[0]), parseInt(endSplit[1]), 0);

      const title = `${cls.course_code} - ${cls.rooms || 'TBA'}`;
      const description = `
        <div style="font-family: sans-serif; padding: 10px;">
          <h3>${title}</h3>
          <p><strong>Time:</strong> ${cls.day}, ${cls.start_time} - ${cls.end_time}</p>
          <p><strong>Group:</strong> ${groupCode}</p>
          <p><strong>Mode:</strong> ${cls.mode}</p>
          <p><strong>Status:</strong> ${cls.status || 'Active'}</p>
          <p><strong>Room:</strong> ${cls.rooms || 'TBA'}</p>
          <p><strong>Faculty:</strong> ${cls.faculty_code}</p>
        </div>
      `;

      events.push({
        title: title,
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        backgroundColor: courseColors[cls.course_code],
        borderColor: courseColors[cls.course_code],
        extendedProps: {
          description: description
        }
      });
    }
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8' />
  <title>Timetable - ${groupCode}</title>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js'></script>
  <script src='https://cdn.jsdelivr.net/npm/sweetalert2@11'></script>
  <style>
    body { font-family: Arial, Helvetica Neue, Helvetica, sans-serif; font-size: 14px; background: #202124; color: white; margin: 40px 10px; padding: 0; }
    #calendar { max-width: 1100px; margin: 0 auto; background: #202124; }
    .fc-theme-standard td, .fc-theme-standard th { border-color: #3c4043; }
    .fc-theme-standard .fc-scrollgrid { border-color: #3c4043; }
    .fc-col-header-cell-cushion { color: #9aa0a6; text-decoration: none; }
    .fc-daygrid-day-number { color: #e8eaed; text-decoration: none; }
    .fc-day-today { background: rgba(138, 180, 248, 0.15) !important; }
    .fc-event { cursor: pointer; border-radius: 4px; padding: 2px 4px; margin-bottom: 2px; border: none; font-size: 0.85em; }
    .fc-event-title { font-weight: 500; }
    .fc-button-primary { background-color: #3c4043 !important; border-color: #3c4043 !important; }
    .fc-button-primary:hover { background-color: #5f6368 !important; }
    .fc-toolbar-title { color: #e8eaed; font-weight: normal; font-size: 1.5em; }
    /* SweetAlert Dark Theme */
    .swal2-popup { background: #2d2e30 !important; color: #e8eaed !important; border-radius: 8px !important; }
    .swal2-title { color: #e8eaed !important; }
    .swal2-html-container { color: #9aa0a6 !important; text-align: left !important; }
    .swal2-confirm { background-color: #8ab4f8 !important; color: #202124 !important; }
  </style>
</head>
<body>
  <div id='calendar'></div>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var calendarEl = document.getElementById('calendar');
      var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: '2026-10-04',
        firstDay: 0, // Kedah: week starts on Sunday
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek'
        },
        fixedWeekCount: false,
        showNonCurrentDates: false,
        events: ${JSON.stringify(events)},
        eventClick: function(info) {
          Swal.fire({
            html: info.event.extendedProps.description,
            confirmButtonText: 'Close',
            customClass: {
              popup: 'swal2-popup'
            }
          });
        },
        eventTimeFormat: {
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }
      });
      calendar.render();
    });
  </script>
</body>
</html>
  `;
}

// 2. Combined HTML Calendar with Academic Weeks
export function generateCombinedHtmlCalendar(campusCode, groupCode, acadGroup, semesterCode) {
  const schedule = getGroupSchedule(campusCode, groupCode);
  if (schedule.length === 0) return "<h1>No classes found.</h1>";

  let acadEvents = [];
  let baseDate = null;
  let semesterLabel = '';
  let academicSession = '';
  // Collect break date ranges to suppress class events during breaks
  const breakRanges = [];

  const pad = n => (n < 10 ? '0' : '') + n;
  const toLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const toLocalTime = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  
  try {
    const acadCalendarToolPath = resolve(__dirname, '../../uitm-academic-calendar/tools/print_academic_calendar.js');
    const raw = execSync(`node "${acadCalendarToolPath}" --view entries --group ${acadGroup} --semester-code ${semesterCode}`).toString();
    const result = JSON.parse(raw).results[0];
    const semester = result.semesters[0];
    const entries = semester.entries;
    semesterLabel = semester.semester_label || '';
    academicSession = semester.academic_session || '';

    let weekCounter = 1;
    let lastYear = 0;

    // Activity color mapping
    const activityColors = {
      'Lecture': '#7B4B94',
      'Break': '#ff9800',
      'Revision': '#607D8B',
      'Examination': '#C62828',
      'EET': '#00897B'
    };

    function getActivityColor(activity) {
      for (const [key, color] of Object.entries(activityColors)) {
        if (activity.includes(key)) return color;
      }
      return '#546E7A';
    }

    const isKedah = ['K', 'T', 'J'].includes(campusCode.toUpperCase());
    const baseYear = parseInt(semesterCode.substring(0, 4), 10) || 2026;

    entries.forEach(entry => {
      let dateRaw = entry.date;
      let usedKedahNote = false;
      if (isKedah && entry.notes && entry.notes.length > 0) {
        const kedahNote = entry.notes.find(n => n.startsWith('*'));
        if (kedahNote) {
          dateRaw = kedahNote;
          usedKedahNote = true;
        }
      }

      const cleanStr = dateRaw.replace(/\*|\[.*?\]/g, '').trim();
      const parts = cleanStr.split(/[-–]/);
      if (parts.length !== 2) return;
      
      let endPart = parts[1].trim();
      let startPart = parts[0].trim();
      
      const endMatch = endPart.match(/(\d+)\s+([a-zA-Z]+)\s+(\d{4})/i);
      if (!endMatch) return;
      
      const endDay = parseInt(endMatch[1], 10);
      const endMonth = endMatch[2];
      const year = parseInt(endMatch[3], 10);
      
      let startDay, startMonth;
      const startMatch = startPart.match(/(\d+)(?:\s+([a-zA-Z]+))?/i);
      if (startMatch) {
        startDay = parseInt(startMatch[1], 10);
        startMonth = startMatch[2] || endMonth;
      } else return;
      
      const months = {
        'january':0, 'february':1, 'march':2, 'april':3, 'may':4, 'june':5,
        'july':6, 'august':7, 'september':8, 'october':9, 'november':10, 'december':11
      };
      
      let startDate = new Date(year, months[startMonth.toLowerCase()], startDay);
      let endDate = new Date(year, months[endMonth.toLowerCase()], endDay);
      if (startDate > endDate) startDate.setFullYear(year - 1);
      
      // Auto-correct year typos
      if (baseYear && (startDate.getFullYear() < baseYear || startDate.getFullYear() > baseYear + 1)) {
        const monthIdx = startDate.getMonth();
        const correctedYear = monthIdx >= 6 ? baseYear : baseYear + 1;
        startDate.setFullYear(correctedYear);
        endDate.setFullYear(endDate.getMonth() >= startDate.getMonth() ? correctedYear : correctedYear + 1);
        if (startDate > endDate) endDate.setFullYear(correctedYear + 1);
      }

      // Kedah shift for entries without explicit Kedah notes
      if (isKedah && !usedKedahNote && entry.activity.toLowerCase() !== 'note') {
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
      }

      if (entry.activity.includes('Lecture')) {
        if (!baseDate) baseDate = new Date(startDate);
        const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        const weeks = Math.round(totalDays / 7);
        for (let i = 0; i < weeks; i++) {
          const wStart = new Date(startDate);
          wStart.setDate(wStart.getDate() + i * 7);
          const wEnd = new Date(wStart);
          wEnd.setDate(wEnd.getDate() + 7);
          
          acadEvents.push({
            title: `WEEK ${weekCounter}`,
            start: toLocal(wStart),
            end: toLocal(wEnd),
            display: 'background',
            color: '#7B4B94',
            allDay: true,
            extendedProps: { type: 'week-banner', weekNum: weekCounter }
          });
          acadEvents.push({
            title: `WEEK ${weekCounter}`,
            start: toLocal(wStart),
            end: toLocal(wEnd),
            color: '#7B4B94',
            allDay: true,
            order: -2,
            extendedProps: { type: 'acad' }
          });
          weekCounter++;
        }
      } else {
        const wEnd = new Date(endDate);
        wEnd.setDate(wEnd.getDate() + 1);
        const color = getActivityColor(entry.activity);

        acadEvents.push({
          title: entry.activity,
          start: toLocal(startDate),
          end: toLocal(wEnd),
          color: color,
          allDay: true,
          order: -1, // Render after week labels but before classes
          extendedProps: { type: 'acad' }
        });

        // Track break ranges to suppress classes
        if (entry.activity.includes('Break')) {
          breakRanges.push({ start: startDate, end: endDate });
        }
      }
    });
  } catch (e) {
    console.error("Failed to fetch academic calendar:", e.message);
  }

  // Course color palette
  const courses = [...new Set(schedule.map(c => c.course_code))];
  const colors = [
    '#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8E24AA', 
    '#F6BF26', '#039BE5', '#3F51B5', '#009688', '#795548',
    '#E91E63', '#00BCD4', '#FF5722', '#673AB7', '#2196F3'
  ];
  const courseColors = {};
  courses.forEach((course, i) => {
    courseColors[course] = colors[i % colors.length];
  });

  const events = [...acadEvents];
  const dayMap = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
  
  // Only place classes in lecture weeks (not break weeks)
  const weekBlocks = acadEvents.filter(e => e.extendedProps?.type === 'week-banner');

  function isDuringBreak(date) {
    for (const range of breakRanges) {
      if (date >= range.start && date <= range.end) return true;
    }
    return false;
  }

  schedule.forEach(cls => {
    if (!cls.start_time || !cls.day) return;
    const targetDayIndex = dayMap[cls.day.toUpperCase()];
    if (targetDayIndex === undefined) return;
    const startSplit = cls.start_time.split(':');
    const endSplit = cls.end_time.split(':');

    weekBlocks.forEach(week => {
      const classDate = new Date(week.start + "T00:00:00");
      while (classDate.getDay() !== targetDayIndex) {
        classDate.setDate(classDate.getDate() + 1);
      }
      
      // Skip if this date falls in a break
      if (isDuringBreak(classDate)) return;

      const eventStart = new Date(classDate);
      eventStart.setHours(parseInt(startSplit[0]), parseInt(startSplit[1]), 0);
      
      const eventEnd = new Date(classDate);
      eventEnd.setHours(parseInt(endSplit[0]), parseInt(endSplit[1]), 0);

      const title = `${cls.course_code} - ${cls.rooms || 'TBA'}`;
      const description = `
        <div style="font-family: sans-serif; padding: 10px;">
          <h3 style="margin:0 0 12px; color: ${courseColors[cls.course_code]};">${cls.course_code}</h3>
          <table style="border-collapse:collapse; width:100%; font-size:0.95em;">
            <tr><td style="padding:4px 8px; color:#9aa0a6;">Day / Time</td><td style="padding:4px 8px; color:#e8eaed;">${cls.day}, ${cls.start_time} – ${cls.end_time}</td></tr>
            <tr><td style="padding:4px 8px; color:#9aa0a6;">Group</td><td style="padding:4px 8px; color:#e8eaed;">${groupCode}</td></tr>
            <tr><td style="padding:4px 8px; color:#9aa0a6;">Mode</td><td style="padding:4px 8px; color:#e8eaed;">${cls.mode}</td></tr>
            <tr><td style="padding:4px 8px; color:#9aa0a6;">Room</td><td style="padding:4px 8px; color:#e8eaed;">${cls.rooms || 'TBA'}</td></tr>
            <tr><td style="padding:4px 8px; color:#9aa0a6;">Faculty</td><td style="padding:4px 8px; color:#e8eaed;">${cls.faculty_code}</td></tr>
          </table>
        </div>
      `;

      events.push({
        title: title,
        start: toLocalTime(eventStart),
        end: toLocalTime(eventEnd),
        backgroundColor: courseColors[cls.course_code],
        borderColor: courseColors[cls.course_code],
        extendedProps: { description: description, type: 'class' }
      });
    });
  });

  const initialDateStr = baseDate ? toLocal(baseDate) : '2026-10-01';

  // Build legend HTML
  const legendItems = courses.map(c => 
    `<span class="legend-item" style="display:inline-flex;align-items:center;margin-right:16px;margin-bottom:6px;"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${courseColors[c]};margin-right:6px;"></span><span class="legend-text">${c}</span></span>`
  ).join('');

  // Build ICS content for Google Calendar export
  const icsLines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UiTM Timetable//Agent//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  
  // Only emit class events (not acad banners)
  events.filter(e => e.extendedProps?.type === 'class').forEach((ev, i) => {
    const dtstart = ev.start.replace(/[-:]/g, '').replace('T', 'T');
    const dtend = ev.end.replace(/[-:]/g, '').replace('T', 'T');
    const summary = ev.title.replace(/,/g, '\\,');
    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:uitm-${groupCode}-${i}@timetable`);
    icsLines.push(`DTSTART;TZID=Asia/Kuala_Lumpur:${dtstart}`);
    icsLines.push(`DTEND;TZID=Asia/Kuala_Lumpur:${dtend}`);
    icsLines.push(`SUMMARY:${summary}`);
    icsLines.push('END:VEVENT');
  });
  icsLines.push('END:VCALENDAR');
  // Use literal \n in the JS code that will be written into the HTML template
  const icsContent = icsLines.join('\\n');

  return `
<!DOCTYPE html>
<html data-theme="dark">
<head>
  <meta charset='utf-8' />
  <meta name='viewport' content='width=device-width, initial-scale=1' />
  <title>${groupCode} — ${academicSession || 'Timetable'}</title>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js'></script>
  <script src='https://cdn.jsdelivr.net/npm/sweetalert2@11'></script>
  <style>
    :root { --bg: #1a1a2e; --surface: #16213e; --border: #2a2a4a; --text: #e8eaed; --text-muted: #9aa0a6; --today-bg: rgba(138,180,248,0.08); --btn-bg: #16213e; --btn-hover: #0f3460; --popup-bg: #16213e; --popup-border: #2a2a4a; --legend-text: #e8eaed; --timegrid-slot: #222244; --timegrid-now: #4285F4; }
    html[data-theme="light"] { --bg: #f5f5f5; --surface: #ffffff; --border: #e0e0e0; --text: #202124; --text-muted: #5f6368; --today-bg: rgba(66,133,244,0.08); --btn-bg: #ffffff; --btn-hover: #e8eaed; --popup-bg: #ffffff; --popup-border: #e0e0e0; --legend-text: #202124; --timegrid-slot: #fafafa; --timegrid-now: #4285F4; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; background: var(--bg); color: var(--text); margin: 0; padding: 20px 10px; transition: background 0.3s, color 0.3s; }
    .header { max-width: 1100px; margin: 0 auto 12px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; }
    .header-left h1 { font-size: 1.4em; font-weight: 600; color: var(--text); margin: 0 0 4px; }
    .header-left p { font-size: 0.9em; color: var(--text-muted); margin: 0; }
    .header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; font-size: 0.82em; font-weight: 500; transition: all 0.2s; }
    .action-btn:hover { background: var(--btn-hover); }
    .action-btn svg { width: 16px; height: 16px; fill: currentColor; }
    .legend { max-width: 1100px; margin: 0 auto 16px; padding: 10px 14px; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); display: flex; flex-wrap: wrap; align-items: center; }
    .legend-label { color: var(--text-muted); font-size: 0.8em; margin-right: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .legend-text { color: var(--legend-text); font-size: 0.85em; }
    #calendar { max-width: 1100px; margin: 0 auto; }
    /* Calendar theming */
    .fc-theme-standard td, .fc-theme-standard th { border-color: var(--border); }
    .fc-theme-standard .fc-scrollgrid { border-color: var(--border); }
    .fc-col-header-cell-cushion { color: var(--text-muted); text-decoration: none; font-weight: 600; text-transform: uppercase; font-size: 0.8em; }
    .fc-daygrid-day-number { color: var(--text); text-decoration: none; }
    .fc-day-today { background: var(--today-bg) !important; }
    .fc-event { cursor: pointer; border-radius: 4px; padding: 1px 4px; margin-bottom: 1px; border: none; font-size: 0.8em; }
    .fc-event-title { font-weight: 500; }
    .fc-daygrid-event-dot { display: none; }
    .fc-button-primary { background-color: var(--btn-bg) !important; border-color: var(--border) !important; color: var(--text) !important; font-size: 0.85em; }
    .fc-button-primary:hover { background-color: var(--btn-hover) !important; }
    .fc-button-active { background-color: var(--btn-hover) !important; border-color: var(--timegrid-now) !important; }
    .fc-toolbar-title { color: var(--text); font-weight: 500; font-size: 1.3em; }
    .fc-daygrid-day-frame { min-height: 100px; }
    .fc-bg-event { opacity: 0.12; }
    /* Kedah weekend: Friday & Saturday (northern Malaysian states) */
    .fc-day-fri, .fc-day-sat { background: rgba(255,255,255,0.03); }
    html[data-theme="light"] .fc-day-fri, html[data-theme="light"] .fc-day-sat { background: rgba(0,0,0,0.03); }
    .fc-col-header-cell.fc-day-fri .fc-col-header-cell-cushion,
    .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion { color: var(--text-muted); opacity: 0.65; }
    /* Time Grid Week View */
    .fc-timegrid-slot { height: 40px; }
    .fc-timegrid-slot-label-cushion { color: var(--text-muted); font-size: 0.75em; }
    .fc-timegrid-axis-cushion { color: var(--text-muted); font-size: 0.75em; }
    .fc-timegrid-col { background: var(--bg); }
    .fc-timegrid-now-indicator-line { border-color: var(--timegrid-now); border-width: 2px; }
    .fc-timegrid-now-indicator-arrow { border-color: var(--timegrid-now); }
    .fc-timegrid-event { border-radius: 6px; border: none; font-size: 0.82em; }
    .fc-timegrid-event .fc-event-main { padding: 4px 6px; }
    .fc-timegrid-event .fc-event-title { font-weight: 600; }
    .fc-timegrid-event .fc-event-time { font-size: 0.85em; opacity: 0.85; }
    /* SweetAlert */
    .swal2-popup { background: var(--popup-bg) !important; color: var(--text) !important; border-radius: 12px !important; border: 1px solid var(--popup-border); }
    .swal2-title { color: var(--text) !important; }
    .swal2-html-container { color: var(--text) !important; text-align: left !important; }
    .swal2-confirm { background-color: #4285F4 !important; color: white !important; border-radius: 6px !important; }
    /* Print styles */
    @media print {
      body { background: white !important; color: black !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header-actions { display: none !important; }
      .header-left h1 { color: black !important; }
      .header-left p { color: #555 !important; }
      .legend { background: #f0f0f0 !important; border: 1px solid #ccc !important; }
      .legend-text { color: black !important; }
      .legend-label { color: #555 !important; }
      .fc-theme-standard td, .fc-theme-standard th { border-color: #ddd !important; }
      .fc-theme-standard .fc-scrollgrid { border-color: #ddd !important; }
      .fc-col-header-cell-cushion { color: #333 !important; }
      .fc-daygrid-day-number { color: #111 !important; }
      .fc-toolbar-title { color: black !important; }
      .fc-button-primary { display: none !important; }
      .fc-header-toolbar { justify-content: center !important; }
      .fc-event { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${groupCode} — ${academicSession || 'Combined Timetable'}</h1>
      <p>${semesterLabel ? semesterLabel : ''} · Campus ${campusCode}</p>
    </div>
    <div class="header-actions">
      <button class="action-btn" id="btn-sync" title="Push automatically to Google Calendar" style="background: var(--timegrid-now); color: white; border: none;"> <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/></svg> Google Calendar Sync </button> <button class="action-btn" id="btn-gcal" title="Download .ics for Google Calendar / Outlook">
        <svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
        Export .ics
      </button>
      <button class="action-btn" id="btn-print" title="Print calendar">
        <svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
        Print
      </button>
      <button class="action-btn" id="btn-theme" title="Toggle light/dark theme">
        <svg viewBox="0 0 24 24" id="theme-icon"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
        <span id="theme-label">Light</span>
      </button>
    </div>
  </div>
  <div class="legend">
    <span class="legend-label">Courses:</span>
    ${legendItems}
  </div>
  <div id='calendar'></div>
  <script>
    // --- Theme Toggle ---
    function setTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('cal-theme', theme);
      document.getElementById('theme-label').textContent = theme === 'dark' ? 'Light' : 'Dark';
      var icon = document.getElementById('theme-icon');
      if (theme === 'light') {
        icon.innerHTML = '<path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>';
      } else {
        icon.innerHTML = '<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>';
      }
    }
    var savedTheme = localStorage.getItem('cal-theme') || 'dark';
    setTheme(savedTheme);
    document.getElementById('btn-theme').addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // --- Print ---
    document.getElementById('btn-print').addEventListener('click', function() {
      window.print();
    });

    // --- Google Calendar Sync ---
      document.getElementById('btn-sync').addEventListener('click', function() {
        Swal.fire({
          title: 'Google Calendar Sync',
          html: '<p style="text-align:left; font-size: 14px;">To safely push this exact timetable directly to your Google Calendar, run the following command in your terminal:</p><pre style="background: #1e1e1e; color: #d4d4d4; padding: 10px; border-radius: 5px; text-align: left; overflow-x: auto; font-family: monospace;">npm run gcal-sync ${campusCode} ${groupCode} ${acadGroup} ${semesterCode}</pre><p style="text-align:left; font-size: 13px; color: #888;">This unified script will use your local OAuth tokens to create a dedicated <b>UiTM Timetable</b> calendar, set up recurring events, skip mid-semester breaks, and attach 15-minute reminders.</p>',
          icon: 'info',
          confirmButtonText: 'Got it!'
        });
      });

      // --- ICS Export ---
    document.getElementById('btn-gcal').addEventListener('click', function() {
      // Use template literal backticks so real newlines aren't messed up by JS parser double quotes
      var icsText = \`${icsLines.join('\n')}\`;
      var blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '${groupCode}_timetable.ics';
      link.click();
      URL.revokeObjectURL(link.href);
    });

    // --- Calendar ---
    document.addEventListener('DOMContentLoaded', function() {
      var calendarEl = document.getElementById('calendar');
      var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        initialDate: '${initialDateStr}',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' },
        firstDay: 0, // Kedah: week starts on Sunday
        nowIndicator: true,
        // Kedah working days: Sunday–Thursday (Fri & Sat are weekend)
        businessHours: {
          daysOfWeek: [0, 1, 2, 3, 4], // Sun–Thu
          startTime: '08:00',
          endTime: '18:00'
        },
        eventOrder: 'order,allDay,-duration,start,title',
        dayMaxEvents: 4,
        moreLinkClick: 'popover',
        slotMinTime: '07:00:00',
        slotMaxTime: '22:00:00',
        slotDuration: '00:30:00',
        slotLabelInterval: '01:00:00',
        allDaySlot: true,
        expandRows: true,
        fixedWeekCount: false,
        showNonCurrentDates: false,
        events: ${JSON.stringify(events)},
        eventClick: function(info) {
          if(info.event.extendedProps.type !== 'class') return;
          Swal.fire({
            html: info.event.extendedProps.description,
            showCloseButton: true,
            confirmButtonText: 'Close',
            width: 420,
            customClass: { popup: 'swal2-popup' }
          });
        },
        eventTimeFormat: { hour: 'numeric', minute: '2-digit', meridiem: 'short' }
      });
      calendar.render();
    });
  </script>
</body>
</html>
  `;
}



