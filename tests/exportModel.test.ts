import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppData, Student } from "../src/types.ts";
import { chooseWeekLayout, resolveExportPlan } from "../src/exportModel.ts";
import { buildAvailabilityWorkbook } from "../src/exportWorkbook.ts";
const student = (weeks: number[], source: Student["source"] = "imported"): Student => ({ id: source, name: source, department: "", source, courses: weeks.length ? [{ id: "c", name: "课程", day: 7, startPeriod: 15, endPeriod: 15, weeks }] : [] });
const data = (students: Student[]): AppData => ({ version: 1, students, selectedIds: [], week: 10, duration: 4 });
const all = { format: "xlsx", scope: "all", startWeek: 1, endWeek: 30 } as const;
test("all preserves empty first week, stops at first empty week after teaching including later classes", () => {
  const input = data([student([2, 3, 4, 7])]);
  const before = JSON.stringify(input), plan = resolveExportPlan(input, all);
  assert.deepEqual(plan.weeks, [1, 2, 3, 4]);
  assert.equal(plan.vacationWeek, 5);
  assert.equal(JSON.stringify(input), before);
  const wb = buildAvailabilityWorkbook(input, new Date(), plan).workbook;
  assert.match(String(wb.worksheets[0].getCell("A2").value), /第1—4周/);
  assert.equal(wb.worksheets[2].getCell("H6").value, "2-4周");
  const rows = wb.worksheets[1].getRows(7, wb.worksheets[1].rowCount - 6)!;
  assert.ok(rows.every((r) => Number(r.getCell(1).value) <= 4));
});
test("all looks at all students, weekends and final period; unknown timetable prevents cutoff", () => {
  const input = data([student([2]), { ...student([3, 4]), id: "other" }]);
  assert.deepEqual(resolveExportPlan(input, all).weeks, [1, 2, 3, 4]);
  input.students.push(student([], "manual"));
  assert.equal(resolveExportPlan(input, all).weeks.length, 30);
  assert.equal(resolveExportPlan(input, all).vacationWeek, null);
  assert.equal(resolveExportPlan(data([student([])]), all).weeks.length, 30);
});
test("current and explicit ranges never apply vacation cutoff; invalid ranges rejected", () => {
  const input = data([student([2, 3])]);
  assert.deepEqual(resolveExportPlan(input, { ...all, scope: "current" }).weeks, [10]);
  const plan = resolveExportPlan(input, { ...all, scope: "range", startWeek: 3, endWeek: 8 });
  assert.deepEqual(plan.weeks, [3, 4, 5, 6, 7, 8]);
  assert.equal(plan.vacationWeek, null);
  const wb = buildAvailabilityWorkbook(input, new Date(), plan).workbook;
  assert.equal(wb.worksheets[2].getCell("H6").value, "3周");
  for (const [startWeek, endWeek] of [[0, 3], [2, 31], [9, 2], [1.5, 3]]) assert.throws(() => resolveExportPlan(input, { ...all, scope: "range", startWeek, endWeek }));
});
test("adaptive layouts fit every week once with bounded width and an 18-week 3 by 6 grid", () => {
  assert.deepEqual(chooseWeekLayout(1), { columns: 1, rows: 1 });
  assert.deepEqual(chooseWeekLayout(18), { columns: 3, rows: 6 });
  const arrangements = new Set<string>();
  for (let n = 1; n <= 30; n++) {
    const { columns, rows } = chooseWeekLayout(n);
    assert.ok(columns >= 1 && columns <= 3 && rows * columns >= n);
    assert.ok(rows * columns - n < columns);
    arrangements.add(`${columns}x${rows}`);
  }
  assert.ok(arrangements.size > 5);
});
