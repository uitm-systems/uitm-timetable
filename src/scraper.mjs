import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const BASE = "https://simsweb4.uitm.edu.my/estudent/class_timetable/";

export async function initSession() {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true, timeout: 120000 }));

  console.log('Initializing session...');
  const res = await client.get(`${BASE}index.cfm`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const $ = cheerio.load(res.data);
  const htm = res.data;

  const idToName = {};
  const hiddenTokens = {};
  
  for (const m of htm.matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/name=["']([^"']+)["']/)?.[1];
    const id = tag.match(/\bid=["']([^"']+)["']/)?.[1];
    const value = tag.match(/value=["']([^"']*)["']/)?.[1] ?? "";
    if (name) {
      hiddenTokens[name] = value;
      if (id) idToName[id] = name;
    }
  }

  let submitPath = "";
  for (const m of htm.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = m[1];
    if (script.includes("check_form_before_submit")) {
      const match = script.match(/url\s*:\s*['"]([^'"]+)['"]/m);
      if (match) submitPath = match[1];

      for (const assign of script.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)\.value\s*=\s*['"]([^'"]*)['"]/g)) {
        const id = assign[1], val = assign[2];
        const name = idToName[id] ?? id;
        hiddenTokens[name] = val;
      }
    }
  }

  const cookieList = await jar.getCookies(BASE);
  let key1 = "", key2 = "", key3 = "";
  for (const c of cookieList) {
    if (c.key === "KEY1") key1 = c.value;
    if (c.key === "KEY2") key2 = c.value;
    if (c.key === "KEY3") key3 = c.value;
  }

  const submitUrl = submitPath 
    ? `${BASE}${submitPath}` 
    : `${BASE}INDEX_RESULT_lII1II11I1lIIII11IIl1I111I.cfm?id1=${key1}&id2=${key2}&id3=${key3}`;

  return { client, jar, hiddenTokens, submitUrl };
}

export async function fetchCourseList(client, campusId, hiddenTokens, submitUrl) {
  const payload = {
    ...hiddenTokens,
    "search_campus": campusId.startsWith("B_") ? "B" : campusId,
    ...(campusId.startsWith("B_") ? { "search_faculty": campusId.slice(2) } : {}),
    "search_course": "",
  };

  const res = await client.post(submitUrl, new URLSearchParams(payload).toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      Referer: `${BASE}index.cfm`, // use index.cfm as referer to match original
    },
  });

  const $ = cheerio.load(res.data);
  const courses = [];
  $("tr.gradeU").each((i, row) => {
    const rawCourse = $(row).find("td:nth-child(2)").text().trim().replace(/^\./, "");
    const href = $(row).find("a").attr("href");
    
    let code = rawCourse;
    let name = "";
    const dashIdx = rawCourse.indexOf("-");
    if (dashIdx !== -1) {
      code = rawCourse.substring(0, dashIdx).trim();
      name = rawCourse.substring(dashIdx + 1).trim();
    }
    
    if (code && href) courses.push({ code, name, href });
  });

  return courses;
}

export async function fetchClassDetails(client, href) {
  const url = `${BASE}${href}`;
  const res = await client.get(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: `${BASE}index.cfm` },
  });

  const $ = cheerio.load(res.data);
  const classes = [];
  $("#example tbody tr").each((_, tr) => {
    const cells = $(tr).find("td");
    if (cells.length > 0) {
      classes.push({
        day_time: $(cells[1]).text().trim(),
        group_code: $(cells[2]).text().trim(),
        mode: $(cells[3]).text().trim(),
        status: $(cells[4]).text().trim(),
        room: $(cells[5]).text().trim(),
        program: $(cells[6]).text().trim(),
        faculty: $(cells[7]).text().trim(),
      });
    }
  });

  return classes;
}

export const delay = (ms) => new Promise(res => setTimeout(res, ms));

export async function fetchCampusList(client) {
  const res = await client.get(`${BASE}combo_select_campus.txt?id=now()`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const lines = res.data.split("<br>");
  const campuses = [];
  for (let line of lines) {
    line = line.replace(/===========================================/g, '').trim();
    if (!line) continue;
    
    const parts = line.split(" - ");
    if (parts.length >= 2) {
      const code = parts[0].trim();
      // Combine the rest as name
      const name = parts.slice(1).join(" - ").trim().replace(/\( Please Select a Faculty \)$/i, "").replace(/-\s*$/, "").trim();
      campuses.push({ code, name });
    }
  }
  return campuses;
}

export async function fetchFacultyList(client) {
  const res = await client.get(`${BASE}combo_select_faculty.txt?id=now()`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  const lines = res.data.split("<br>");
  const faculties = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const parts = line.split(" - ");
    if (parts.length >= 2) {
      faculties.push({ code: parts[0].trim(), name: parts.slice(1).join(" - ").trim() });
    }
  }
  return faculties;
}
