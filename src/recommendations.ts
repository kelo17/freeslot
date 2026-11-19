import type { Course, RecommendationFilters, Student } from "./types";

export interface WeekResult {
  week: number;
  free: Student[];
  busy: { student: Student; courses: Course[] }[];
  unknown: Student[];
}
export interface MeetingRecommendation {
  id: string;
  day: number;
  startPeriod: number;
  endPeriod: number;
  total: number;
  free: Student[];
  applicableWeeks: number[];
  requestedWeeks: number[];
  fixedAll: boolean;
  byWeek: WeekResult[];
}

export function recommendMeetings(
  students: Student[],
  filters: RecommendationFilters,
): MeetingRecommendation[] {
  const selected = students.filter((s) => filters.selectedIds.includes(s.id));
  const weeks = [...new Set(filters.weeks)].sort((a, b) => a - b);
  if (
    !selected.length ||
    !weeks.length ||
    !Number.isInteger(filters.duration) ||
    filters.duration < 1 ||
    filters.startPeriod < 1 ||
    filters.endPeriod > 15 ||
    filters.startPeriod > filters.endPeriod
  )
    return [];
  const results: MeetingRecommendation[] = [];
  for (const day of [...new Set(filters.days)].sort((a, b) => a - b)) {
    if (day < 1 || day > 7) continue;
    for (
      let start = filters.startPeriod;
      start + filters.duration - 1 <= filters.endPeriod;
      start++
    ) {
      const end = start + filters.duration - 1;
      const byWeek = weeks.map((week) => {
        const free: Student[] = [],
          busy: WeekResult["busy"] = [],
          unknown: Student[] = [];
        for (const student of selected) {
          if (student.source === "manual" && !student.courses.length) {
            unknown.push(student);
            continue;
          }
          // Any overlap anywhere in the complete meeting window is a conflict.
          const courses = student.courses.filter(
            (c) =>
              c.day === day &&
              c.weeks.includes(week) &&
              c.startPeriod <= end &&
              c.endPeriod >= start,
          );
          if (courses.length) busy.push({ student, courses });
          else free.push(student);
        }
        return { week, free, busy, unknown };
      });
      const bestCount = Math.max(...byWeek.map((w) => w.free.length));
      if (!bestCount) continue; // Never recommend a window where nobody is confirmed free.
      // For weeks with maximum attendance, coverage requires the exact same people.
      // The selected student order is stable across weeks, including for tied groups.
      const cohorts = new Map<string, { free: Student[]; weeks: number[] }>();
      for (const result of byWeek) {
        if (result.free.length !== bestCount) continue;
        const key = JSON.stringify(result.free.map((student) => student.id));
        const cohort = cohorts.get(key);
        if (cohort) cohort.weeks.push(result.week);
        else cohorts.set(key, { free: result.free, weeks: [result.week] });
      }
      const best = [...cohorts.values()].reduce((first, next) =>
        next.weeks.length > first.weeks.length ? next : first,
      );
      results.push({
        id: `${day}-${start}-${end}`,
        day,
        startPeriod: start,
        endPeriod: end,
        total: selected.length,
        free: best.free,
        applicableWeeks: best.weeks,
        requestedWeeks: weeks,
        fixedAll:
          bestCount === selected.length && best.weeks.length === weeks.length,
        byWeek,
      });
    }
  }
  return results.sort(
    (a, b) =>
      Number(b.fixedAll) - Number(a.fixedAll) ||
      b.free.length - a.free.length ||
      b.applicableWeeks.length - a.applicableWeeks.length ||
      a.day - b.day ||
      a.startPeriod - b.startPeriod,
  );
}

export function meetingText(r: MeetingRecommendation): string {
  const lines = [
    `会议时间：星期${"一二三四五六日"[r.day - 1]} 第${r.startPeriod}—${r.endPeriod}节（连续${r.endPeriod - r.startPeriod + 1}节）`,
    `适用教学周：第${r.applicableWeeks.join("、")}周`,
    `课表空闲：${r.free.length}/${r.total}人（${r.free.map((s) => s.name).join("、")}）`,
  ];
  const conflicts = new Map<string, { text: string; weeks: number[] }>();
  for (const w of r.byWeek)
    for (const { student, courses } of w.busy)
      for (const c of courses) {
        const key = `${student.id}:${c.id}`;
        const item = conflicts.get(key) || {
          text: `${student.name}：${c.name}${c.code ? `（${c.code}）` : ""}，第${c.startPeriod}—${c.endPeriod}节`,
          weeks: [],
        };
        item.weeks.push(w.week);
        conflicts.set(key, item);
      }
  for (const item of conflicts.values())
    lines.push(`冲突（第${item.weeks.join("、")}周）：${item.text}`);
  const unknown = [
    ...new Map(
      r.byWeek.flatMap((w) => w.unknown).map((s) => [s.id, s]),
    ).values(),
  ];
  if (unknown.length)
    lines.push(`课表未知：${unknown.map((s) => s.name).join("、")}`);
  if (r.byWeek.every((w) => !w.busy.length && !w.unknown.length))
    lines.push("所选教学周均无课程冲突。");
  return lines.join("\n");
}
