import type { AppData } from "./types.ts";
import { analyzeAvailability } from "./availability.ts";
import { recommendMeetings } from "./recommendations.ts";
import { MAX_WEEK } from "./parser.ts";

export type ExportFormat = "pdf" | "png" | "jpg" | "xlsx";
export type ExportScope = "current" | "range" | "all";
export interface ExportOptions { format: ExportFormat; scope: ExportScope; startWeek: number; endWeek: number }
export interface ExportPlan { weeks: number[]; vacationWeek: number | null; label: string }
export const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function resolveExportPlan(data: AppData, options: ExportOptions): ExportPlan {
  if (!data.students.length) throw new Error("请先添加同学并保存课表。");
  const valid = (v: number) => Number.isInteger(v) && v >= 1 && v <= MAX_WEEK;
  let start = 1, end = MAX_WEEK;
  if (options.scope === "current") start = end = data.week;
  if (options.scope === "range") {
    start = options.startWeek; end = options.endWeek;
  }
  if (!valid(start) || !valid(end) || start > end) throw new Error("请选择1—30周内有效的起止周次，开始周不能晚于结束周。");
  let vacationWeek: number | null = null;
  if (options.scope === "all") {
    const hasUnknown = data.students.some((s) => s.source === "manual" && !s.courses.length);
    let teachingStarted = false;
    if (!hasUnknown) {
      for (let week = 1; week <= MAX_WEEK; week++) {
        const hasClass = data.students.some((s) => s.courses.some((c) => c.weeks.includes(week)));
        if (hasClass) teachingStarted = true;
        else if (teachingStarted) { vacationWeek = week; end = week - 1; break; }
      }
    }
  }
  const weeks = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return { weeks, vacationWeek, label: start === end ? `第${start}周` : `第${start}—${end}周` };
}

/** Compare candidate grids by aspect, spare cells and total scrolling. */
export function chooseWeekLayout(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_WEEK) throw new Error("导出周数须为1—30。");
  const target = count <= 4 ? 1.3 : 0.65;
  let best = { columns: 1, rows: count, score: Infinity };
  for (let columns = 1; columns <= Math.min(3, count); columns++) {
    const rows = Math.ceil(count / columns);
    const aspect = columns * 0.85 / rows;
    const score = Math.abs(Math.log(aspect / target)) + (columns * rows - count) / count * 1.3;
    if (score < best.score) best = { columns, rows, score };
  }
  return { columns: best.columns, rows: best.rows };
}

export function exportTimestamp(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date).replace("T", " ");
}
export function exportFilename(plan: ExportPlan, format: ExportFormat, date: Date) {
  return `同频_空闲查询_${plan.label}_${exportTimestamp(date).replace(/[-:]/g, "").replace(" ", "_")}.${format}`;
}

export function buildExportWeeks(data: AppData, plan: ExportPlan) {
  const selectedIds = data.students.map((s) => s.id);
  return plan.weeks.map((week) => ({
    week,
    analysis: analyzeAvailability(data.students, selectedIds, week, 2),
    meetings: recommendMeetings(data.students, { selectedIds, weeks: [week], duration: 2, days: [1, 2, 3, 4, 5, 6, 7], startPeriod: 1, endPeriod: 15 }),
  }));
}
export type ExportWeek = ReturnType<typeof buildExportWeeks>[number];
