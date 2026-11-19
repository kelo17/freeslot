import type { Course, Day } from "./types";

export interface CourseDraft {
  id: string;
  name: string;
  code: string;
  teacher: string;
  location: string;
  day: number;
  startPeriod: number;
  endPeriod: number;
  weeksText: string;
  sourceText: string;
  notes: string[];
}

export const MAX_WEEK = 30;
const weekPattern =
  /(?:第\s*)?\d+(?:\s*[-—–~～至]\s*\d+)?(?:\s*[,，、]\s*\d+(?:\s*[-—–~～至]\s*\d+)?)*\s*周(?:\s*[（(]?\s*(?:单双周|单周|双周|每周|全周|单|双)\s*[）)]?)?/g;

// Strict numeric parsing: never substitute a whole semester for missing weeks.
export function parseWeeks(input: string): number[] {
  const groups = [...input.matchAll(weekPattern)];
  if (groups.length > 1) {
    if (input.replace(weekPattern, "").replace(/[\s,，、;；]/g, ""))
      throw new Error("周次中含有无法识别的内容");
    return [...new Set(groups.flatMap((m) => parseWeeks(m[0])))].sort(
      (a, b) => a - b,
    );
  }
  let text = input
    .trim()
    .replace(/\s/g, "")
    .replace(/第/g, "")
    .replace(/[（()）]/g, "");
  const mode = /单双周/.test(text)
    ? "all"
    : /单周|周单$/.test(text)
      ? "odd"
      : /双周|周双$/.test(text)
        ? "even"
        : "all";
  text = text
    .replace(/单双周|单周|双周|每周|全周|周|单|双/g, "")
    .replace(/[—–~～至]/g, "-")
    .replace(/[，、]/g, ",");
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(text))
    throw new Error("请填写明确周次，如 2-17周单周 或 11,12,13周");
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const [start, end = start] = part.split("-").map(Number);
    if (start < 1 || end > MAX_WEEK || start > end)
      throw new Error(`周次须在 1—${MAX_WEEK} 周内，且起始周不大于结束周`);
    for (let w = start; w <= end; w++)
      if (mode === "all" || (mode === "odd" ? w % 2 === 1 : w % 2 === 0))
        values.add(w);
  }
  if (!values.size) throw new Error("单双周筛选后没有上课周次，请检查");
  return [...values].sort((a, b) => a - b);
}

export function formatWeeks(weeks: number[]): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  if (!sorted.length) return "";
  if (sorted.every((w, i) => i === 0 || w === sorted[i - 1] + 1))
    return `${sorted[0]}${sorted.length > 1 ? `-${sorted.at(-1)}` : ""}周`;
  return `${sorted.join(",")}周`;
}

export function draftFromCourse(c: Course): CourseDraft {
  return {
    ...c,
    code: c.code || "",
    teacher: c.teacher || "",
    location: c.location || "",
    weeksText: formatWeeks(c.weeks),
    sourceText: c.sourceText || "",
    notes: [],
  };
}

export function validateDraft(d: CourseDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push("缺少课程名称");
  if (!Number.isInteger(d.day) || d.day < 1 || d.day > 7)
    errors.push("请选择星期");
  if (
    !Number.isInteger(d.startPeriod) ||
    !Number.isInteger(d.endPeriod) ||
    d.startPeriod < 1 ||
    d.endPeriod > 15 ||
    d.startPeriod > d.endPeriod
  )
    errors.push("节次须在 1—15 节内且起止顺序正确");
  try {
    parseWeeks(d.weeksText);
  } catch (e) {
    errors.push((e as Error).message);
  }
  return errors;
}

export function coursesFromDrafts(drafts: CourseDraft[]): Course[] {
  const courses: Course[] = [];
  for (const d of drafts) {
    const errors = validateDraft(d);
    if (errors.length) throw new Error(errors.join("；"));
    const course: Course = {
      id: d.id,
      name: d.name.trim(),
      code: d.code.trim(),
      teacher: d.teacher.trim(),
      location: d.location.trim(),
      day: d.day as Day,
      startPeriod: d.startPeriod,
      endPeriod: d.endPeriod,
      weeks: parseWeeks(d.weeksText),
      sourceText: d.sourceText,
    };
    // First coalesce adjacent cells only when every metadata field AND weeks agree.
    courses.push(course);
  }
  const sameIdentity = (a: Course, b: Course) =>
    a.name === b.name &&
    a.code === b.code &&
    a.teacher === b.teacher &&
    a.location === b.location &&
    a.day === b.day;
  const merged: Course[] = [];
  for (const c of courses.sort((a, b) => a.startPeriod - b.startPeriod)) {
    const same = merged.find(
      (m) =>
        sameIdentity(m, c) &&
        JSON.stringify(m.weeks) === JSON.stringify(c.weeks) &&
        c.startPeriod <= m.endPeriod + 1 &&
        c.endPeriod >= m.startPeriod - 1,
    );
    if (same) {
      same.startPeriod = Math.min(same.startPeriod, c.startPeriod);
      same.endPeriod = Math.max(same.endPeriod, c.endPeriod);
      same.sourceText += `\n---\n${c.sourceText}`;
    } else merged.push(c);
  }
  const result: Course[] = [];
  for (const c of merged) {
    const same = result.find(
      (m) =>
        sameIdentity(m, c) &&
        m.startPeriod === c.startPeriod &&
        m.endPeriod === c.endPeriod,
    );
    if (same) {
      same.weeks = [...new Set([...same.weeks, ...c.weeks])].sort(
        (a, b) => a - b,
      );
      same.sourceText += `\n---\n${c.sourceText}`;
    } else result.push(c);
  }
  return result;
}

function cleanCell(text: string): string {
  return text
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Math.min(Number(n), 0x10ffff)),
    )
    .replace(/\*\*|__/g, "")
    .replace(/\r/g, "")
    // School clipboard titles may wrap visually inside the brackets.
    .replace(/([A-Za-z][\w.-]*)\s*【([^】]+)】/g, (_, code, name) =>
      `${code}【${name.replace(/\s*\n\s*/g, "").trim()}】`,
    )
    .trim();
}

function cells(line: string): string[] {
  let text = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  // Split only unescaped table pipes; restore the escaped literal afterwards.
  return text.split(/(?<!\\)\|/).map((s) => s.replace(/\\\|/g, "|").trim());
}

// Spreadsheet clipboard TSV: quoted cells may contain physical newlines.
function tsvRows(text: string): { rows: string[][]; unclosed: boolean } {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || !value.trim())) {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "\t" || char === "\n")) {
      row.push(value.replace(/\r$/, ""));
      value = "";
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
    } else value += char;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return { rows, unclosed: quoted };
}

function dayOf(text: string): number {
  const match = text.match(/(?:星期|周|礼拜)\s*([一二三四五六日天1-7])/);
  return match
    ? "一二三四五六日".indexOf(match[1].replace("天", "日")) + 1 ||
        Number(match[1])
    : 0;
}

function periods(text: string, bare = false): [number, number][] {
  const normalized = text.replace(/[—–~～至]/g, "-").replace(/[，、]/g, ",");
  const m =
    normalized.match(/(?:第\s*)?(\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+)*)\s*节/) ||
    (bare
      ? normalized.match(/^\s*(\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+)*)\s*$/)
      : null);
  if (!m) return [];
  const ns: number[] = [];
  for (const p of m[1].replace(/\s/g, "").split(",")) {
    const [a, b = a] = p.split("-").map(Number);
    if (a < 1 || b > 15 || a > b) return [];
    for (let n = a; n <= b; n++) ns.push(n);
  }
  const ranges: [number, number][] = [];
  for (const n of [...new Set(ns)].sort((a, b) => a - b)) {
    const last = ranges.at(-1);
    if (last && last[1] + 1 === n) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}

function isMeta(line: string): boolean {
  return (
    /^(?:课程代码|课程编号|代码|编号|教师|任课教师|授课教师|老师|地点|上课地点|教室|周次|上课周次|星期|节次|时间)\s*[:：]/.test(
      line,
    ) ||
    /周|\d\s*节/.test(line) ||
    /^[A-Za-z]*\d[\w.-]*$/.test(line) ||
    /(?:楼|校区|教室|实验室)/.test(line)
  );
}

function splitBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const title =
      /^(?:课程名称|课程名|课程)\s*[:：]/.test(line) ||
      /[（(][A-Za-z]*\d[\w.-]*[)）]/.test(line) ||
      /^[\w.-]+【.+】$/.test(line);
    const newBareTitle =
      !isMeta(line) &&
      !/[:：]/.test(line) &&
      current.some((l) => /\d.*周/.test(l)) &&
      ((isMeta(lines[i + 1] || "") &&
        /代码|编号|^[A-Za-z]*\d/.test(lines[i + 1] || "")) ||
        /地点|教室|楼/.test(current.at(-1) || ""));
    if (
      /^[-=]{3,}$/.test(line) ||
      (current.length && (title || newBareTitle))
    ) {
      blocks.push(current);
      current = [];
      if (/^[-=]{3,}$/.test(line)) continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function parseBlock(
  lines: string[],
  day: number,
  fallback: [number, number][],
  source: string,
): CourseDraft[] {
  const text = lines.join("\n");
  const schoolTitle = lines
    .find((l) => /^[\w.-]+【.+】$/.test(l))
    ?.match(/^([\w.-]+)【(.+)】$/);
  const nameLine =
    schoolTitle?.[0] ||
    lines.find((l) => /^(?:课程名称|课程名|课程)\s*[:：]/.test(l)) ||
    lines.find((l) => !isMeta(l)) ||
    "";
  const embeddedCode = nameLine.match(/[（(]([A-Za-z]*\d[\w.-]*)[)）]/)?.[1];
  const code =
    schoolTitle?.[1] ||
    text
      .match(/(?:课程代码|课程编号|代码|编号)\s*[:：]\s*([^\n]+)/)?.[1]
      ?.trim() ||
    embeddedCode ||
    lines.find((l) => /^[A-Za-z]*\d[\w.-]*$/.test(l)) ||
    "";
  const name =
    schoolTitle?.[2] ||
    nameLine
      .replace(/^(?:课程名称|课程名|课程)\s*[:：]\s*/, "")
      .replace(/[（(][A-Za-z]*\d[\w.-]*[)）]/, "")
      .trim();
  const weekly = [...text.matchAll(weekPattern)];
  const meetingLines = lines
    .map((l, i) => (/\d.*周/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const results: CourseDraft[] = [];
  const count = Math.max(weekly.length, 1);
  for (let n = 0; n < count; n++) {
    let segment = text;
    if (schoolTitle && weekly.length) {
      // Keep the teacher and room continuation lines up to the next schedule.
      segment = text.slice(weekly[n].index, weekly[n + 1]?.index ?? text.length);
    } else if (weekly.length > 1) {
      const at = meetingLines[n] ?? 0;
      const previous = meetingLines[n - 1] ?? -1;
      let from = n === 0 ? 0 : previous + 1;
      for (let i = at; i > previous; i--)
        if (/教师|老师/.test(lines[i])) {
          from = i;
          break;
        }
      let to = meetingLines[n + 1] ?? lines.length;
      for (let i = at + 1; i < to; i++)
        if (/教师|老师/.test(lines[i])) {
          to = i;
          break;
        }
      segment = lines.slice(from, to).join("\n");
    }
    const segmentLines = segment.split("\n");
    const weekAt = segmentLines.findIndex((l) => /\d.*周/.test(l));
    const bareTeacher = segmentLines
      .slice(0, weekAt < 0 ? 0 : weekAt)
      .filter((l) => l !== nameLine && !isMeta(l) && !/[:：]/.test(l))
      .at(-1);
    const scheduleLine =
      schoolTitle && weekly[n]
        ? segment.slice(segment.match(weekPattern)?.[0]?.length || 0).trim()
        : "";
    const inline = scheduleLine.match(
      /^(.*?)\s+((?:[^\s]*?(?:教学楼|大楼|实验楼|校区)|教室|实验室|校外|地点[:：]).*)$/s,
    );
    // Excel uses wide spacing between teacher and room; single spaces inside
    // English teacher names are significant and must remain intact.
    const schoolFields = scheduleLine.split(/\s{2,}|\n+/).map((s) => s.trim()).filter(Boolean);
    const schoolTeacher = schoolTitle && !isMeta(schoolFields[0] || "")
      ? schoolFields[0] || ""
      : "";
    const schoolLocation = schoolTitle && schoolFields.length > 1
      ? schoolFields.slice(1).join(" ")
      : schoolTitle && /楼|校区|实验室|校外/.test(scheduleLine) && !inline
        ? scheduleLine
        : "";
    const teacher =
      segment
        .match(/(?:任课教师|授课教师|教师|老师)\s*[:：]\s*([^\n]+)/)?.[1]
        ?.trim() ||
      inline?.[1]?.trim() ||
      schoolTeacher ||
      bareTeacher ||
      "";
    const location =
      segment.match(/(?:上课地点|地点|教室)\s*[:：]\s*([^\n]+)/)?.[1]?.trim() ||
      inline?.[2]?.trim() ||
      schoolLocation ||
      segmentLines.find(
        (l) => /楼|校区|实验室/.test(l) && !/周|节|课程/.test(l),
      ) ||
      segmentLines
        .slice(weekAt < 0 ? segmentLines.length : weekAt + 1)
        .find((l) => !isMeta(l) && l !== nameLine && !/[:：]/.test(l)) ||
      "";
    const ownPeriods = periods(segment);
    const explicitInvalidPeriods =
      /\d[^\n]*节/.test(segment) && !ownPeriods.length;
    const ranges = explicitInvalidPeriods
      ? [[0, 0] as [number, number]]
      : ownPeriods.length
        ? ownPeriods
        : fallback.length
          ? fallback
          : [[0, 0] as [number, number]];
    const labelledWeeks = segment
      .match(/(?:上课周次|周次)\s*[:：]\s*([^\n]+)/)?.[1]
      ?.trim();
    for (const [startPeriod, endPeriod] of ranges)
      results.push({
        id: `parsed-${results.length}-${Math.random().toString(36).slice(2)}`,
        name,
        code,
        teacher,
        location,
        day: dayOf(segment) || day,
        startPeriod,
        endPeriod,
        weeksText: labelledWeeks || weekly[n]?.[0] || "",
        sourceText: source,
        notes: [
          !teacher && "教师未明确识别，请核对",
          !location && "地点未明确识别，请核对",
          !code && "课程代码未明确识别，请核对",
        ].filter(Boolean) as string[],
      });
  }
  return results;
}

export function parseTimetable(markdown: string): {
  drafts: CourseDraft[];
  warnings: string[];
} {
  const content = markdown.replace(/^\uFEFF/, "");
  const tsv =
    content.includes("\t") && !/^\s*\|.*\|/m.test(content)
      ? tsvRows(content)
      : null;
  const rows =
    tsv?.rows ||
    content
      .split(/\r?\n/)
      .filter((l) => l.includes("|"))
      .map(cells);
  const drafts: CourseDraft[] = [];
  const warnings: string[] = [];
  if (tsv?.unclosed)
    warnings.push("文本中有未闭合的单元格引号，请核对原始内容。");
  let header: string[] = [];
  let mode: "matrix" | "list" | null = null;
  for (const row of rows) {
    if (row.every((c) => /^:?-{2,}:?$/.test(c.replace(/\s/g, "")))) continue;
    const cleaned = row.map(cleanCell);
    if (
      /^(?:节次|时间|时段)?$/.test(cleaned[0]) &&
      cleaned.some((h) => dayOf(h))
    ) {
      header = cleaned;
      mode = "matrix";
      continue;
    }
    if (
      cleaned.some((h) => /课程名称|^课程$|^课程名$/.test(h)) &&
      cleaned.some((h) => /^星期$|^周次$|^上课周次$/.test(h))
    ) {
      header = cleaned;
      mode = "list";
      continue;
    }
    if (!mode) continue;
    if (mode === "list") {
      const lines = cleaned
        .map((value, i) =>
          value
            ? `${header[i] || "其他"}：${/周次/.test(header[i] || "") && !value.includes("周") ? `${value}周` : value}`
            : "",
        )
        .filter(Boolean);
      const dayIndex = header.findIndex((h) => /星期/.test(h));
      const periodIndex = header.findIndex((h) => /节次/.test(h));
      drafts.push(
        ...parseBlock(
          lines,
          dayOf(cleaned[dayIndex] || ""),
          periods(cleaned[periodIndex] || "", true),
          row.join(" | "),
        ),
      );
    } else {
      const ranges = periods(
        cleaned.find(
          (_, i) => !dayOf(header[i] || "") && periods(cleaned[i], true).length,
        ) || "",
        true,
      );
      for (let i = 0; i < header.length; i++) {
        const day = dayOf(header[i]);
        if (!day || !cleaned[i] || /^[-—–/无空\s]*$/.test(cleaned[i])) continue;
        const blocks = splitBlocks(
          cleaned[i]
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
        for (const block of blocks)
          drafts.push(
            ...parseBlock(
              block,
              day,
              ranges,
              `${header[i]} · ${row[0]}\n${block.join("\n")}`,
            ),
          );
      }
    }
  }
  if (!mode)
    warnings.push(
      "未识别到课表表头。请使用星期为列的 Markdown 表格，或包含课程名称、星期、节次、周次的课程列表。",
    );
  if (mode && !drafts.length) warnings.push("没有识别到课程，请检查表格内容。");
  if (drafts.some((d) => validateDraft(d).length))
    warnings.push(
      "部分课程缺少或包含无效的名称、星期、节次或周次，请修正后保存；不会自动填满整个学期。",
    );
  if (drafts.length && drafts.every((d) => !validateDraft(d).length)) {
    return {
      drafts: coursesFromDrafts(drafts).map((c) => ({
        ...draftFromCourse(c),
        notes: [
          ...new Set(
            drafts
              .filter(
                (d) =>
                  d.name === c.name &&
                  d.code === c.code &&
                  d.teacher === c.teacher &&
                  d.location === c.location,
              )
              .flatMap((d) => d.notes),
          ),
        ],
      })),
      warnings,
    };
  }
  return { drafts, warnings };
}
