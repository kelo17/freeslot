import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { buildAvailabilityWorkbook as buildWorkbook } from "../src/exportWorkbook.ts";
import { chooseWeekLayout, resolveExportPlan } from "../src/exportModel.ts";
import { parseTimetable, coursesFromDrafts } from "../src/parser.ts";
import type { AppData, Student, Course } from "../src/types.ts";

const course = (id: string, period: number, weeks: number[]): Course => ({
  id, name: id, day: 1, startPeriod: period, endPeriod: period, weeks,
});
const student = (id: string, courses: Course[], source: Student["source"] = "imported"): Student => ({ id, name: id, department: "学院", courses, source });
const data = (students: Student[]): AppData => ({ version: 1, students, selectedIds: [], week: 2, duration: 4 });
const date = new Date("2026-10-10T15:04:05Z");
const fullPlan = (input: AppData) => resolveExportPlan(input, { format: "xlsx", scope: "range", startWeek: 1, endWeek: 30 });
const buildAvailabilityWorkbook = (input: AppData, time = date) => buildWorkbook(input, time, fullPlan(input));
function heatCell(workbook: ExcelJS.Workbook, week: number, day: number, period: number) {
  const columns = chooseWeekLayout(30).columns, index = week - 1;
  return workbook.worksheets[0].getCell(9 + Math.floor(index / columns) * 20 + period, 1 + index % columns * 9 + day);
}

test("export includes all saved students, all 30 weeks, unknowns and exact two-period intersections", () => {
  const input = data([student("甲", [course("仅第二节有课", 2, [2])]), student("乙", [course("仅第一节有课", 1, [2])]), student("未知", [], "manual")]);
  const original = JSON.stringify(input);
  const { workbook, filename } = buildAvailabilityWorkbook(input, date);
  assert.equal(filename, "同频_空闲查询_第1—30周_20261010_230405.xlsx");
  assert.deepEqual(workbook.worksheets.map((s) => s.name), ["每周空闲图", "连续2节可约时间", "课表明细"]);
  assert.equal(heatCell(workbook, 2, 1, 1).value, "1/3\n含未知");
  assert.equal(heatCell(workbook, 2, 1, 2).value, "1/3\n含未知");
  assert.match(String(workbook.worksheets[0].getCell(188, 19).value), /第 30 周/);
  const windows = workbook.worksheets[1];
  const rows = windows.getRows(7, windows.rowCount - 6)!;
  assert.ok(!rows.some((row) => row.getCell(1).value === 2 && row.getCell(2).value === "周一" && row.getCell(3).value === "第1—2节"));
  const overlap = rows.find((r) => r.getCell(1).value === 2 && r.getCell(2).value === "周一" && r.getCell(3).value === "第2—3节")!;
  assert.equal(overlap.getCell(4).value, "1/3");
  assert.equal(overlap.getCell(5).value, "乙");
  assert.match(String(overlap.getCell(6).value), /仅第二节有课/);
  assert.match(String(overlap.getCell(6).value), /未知：未知/);
  assert.equal(workbook.worksheets[2].getCell("K8").value, "课表未知（未导入）");
  assert.equal(JSON.stringify(input), original);
});

test("synthetic lab timetable matches independent occupancy for every exported week and window", () => {
  const parsed = parseTimetable(readFileSync(new URL("../examples/lab-week.txt", import.meta.url), "utf8"));
  const courses = coursesFromDrafts(parsed.drafts);
  assert.equal(courses.length, 5);
  const students = [student("样例课表验证", courses)];
  const { workbook } = buildAvailabilityWorkbook(data(students), date);
  const busy = (week: number, day: number, period: number) => courses.some((c) => c.day === day && c.weeks.includes(week) && c.startPeriod <= period && c.endPeriod >= period);
  for (let week = 1; week <= 30; week++) {
    for (let day = 1; day <= 7; day++) {
      for (let p = 1; p <= 15; p++) {
        const cell = heatCell(workbook, week, day, p);
        assert.equal(cell.value, busy(week, day, p) ? "0/1" : "1/1");
        assert.equal((cell.fill as ExcelJS.FillPattern).fgColor?.argb, busy(week, day, p) ? "F9DFDC" : "D9EFDD");
      }
    }
  }
  const windows = workbook.worksheets[1];
  const expected = new Set<string>();
  for (let week = 1; week <= 30; week++) for (let day = 1; day <= 7; day++) for (let p = 1; p < 15; p++) {
    if (!busy(week, day, p) && !busy(week, day, p + 1)) expected.add(`${week}:周${"一二三四五六日"[day - 1]}:第${p}—${p + 1}节`);
  }
  const actual = new Set<string>();
  for (const row of windows.getRows(7, windows.rowCount - 6)!) {
    actual.add(`${row.getCell(1).value}:${row.getCell(2).value}:${row.getCell(3).value}`);
    assert.equal(row.getCell(4).value, "1/1");
  }
  assert.deepEqual(actual, expected);
});

test("xlsx round trip keeps styles, typed periods, discrete weeks and literal formula-like text", async () => {
  const s = student("=1+1", [{ ...course("=HYPERLINK(测试)", 15, [3, 11, 13]), code: "00123", teacher: "教师", location: "地点" }]);
  const { workbook } = buildAvailabilityWorkbook(data([s]), date);
  const bytes = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(bytes);
  const details = read.worksheets[2];
  assert.equal(details.getCell("A6").value, "=1+1");
  assert.equal(details.getCell("C6").value, "=HYPERLINK(测试)");
  assert.equal(details.getCell("D6").value, "00123");
  assert.equal(details.getCell("F6").value, 15);
  assert.match(String(details.getCell("H6").value), /3.*11.*13/);
  assert.equal(read.worksheets[0].getCell("B10").fill.type, "pattern");
  assert.ok(details.autoFilter);
  assert.equal(read.worksheets[1].views[0].state, "frozen");
  for (const sheet of read.worksheets) sheet.eachRow((row) => row.eachCell((cell) => assert.equal(cell.formula, undefined)));
});

test("all unknown students produce an explicit no-window row for every week", () => {
  const { workbook } = buildAvailabilityWorkbook(data([student("未导入", [], "manual")]), date);
  const windows = workbook.worksheets[1];
  assert.equal(windows.rowCount, 36);
  assert.equal(windows.getCell("C7").value, "无可约窗口");
  assert.match(String(windows.getCell("F7").value), /未知/);
  assert.throws(() => buildAvailabilityWorkbook(data([])), /请先添加同学/);
});
