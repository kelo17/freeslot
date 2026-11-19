import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeAvailability } from "../src/availability.ts";
import type { Student, Course } from "../src/types.ts";
import { parseTimetable, coursesFromDrafts } from "../src/parser.ts";
import { readFileSync } from "node:fs";
const course = (patch: Partial<Course> = {}): Course => ({
  id: "course",
  name: "课程",
  day: 1,
  startPeriod: 2,
  endPeriod: 3,
  weeks: [3, 5],
  ...patch,
});
const student = (
  id: string,
  courses: Course[],
  source: Student["source"] = "imported",
): Student => ({ id, name: id, department: "学院", source, courses });

test("selected participants, absolute odd/even and discrete weeks determine each ratio", () => {
  const students = [
    student("甲", [course()]),
    student("乙", [course({ weeks: [2, 4] })]),
    student("丙", [course({ weeks: [11, 13] })]),
  ];
  for (const [week, busy] of [
    [2, "乙"],
    [3, "甲"],
    [11, "丙"],
  ] as const) {
    const result = analyzeAvailability(students, ["甲", "乙", "丙"], week);
    assert.equal(result.slots[0][1].free.length, 2);
    assert.equal(result.slots[0][1].total, 3);
    assert.equal(result.slots[0][1].status, "partial");
    assert.deepEqual(
      result.slots[0][1].busy.map((v) => v.student.id),
      [busy],
    );
  }
  assert.equal(
    analyzeAvailability(students, ["乙", "丙"], 3).slots[0][1].status,
    "all-free",
  );
  assert.equal(
    analyzeAvailability(students, ["甲"], 3).slots[0][1].status,
    "busy",
  );
});
test("details retain every overlapping course but count each busy student once", () => {
  const courses = [
    course({ id: "first", teacher: "教师甲" }),
    course({ id: "second", teacher: "教师乙" }),
  ];
  const slot = analyzeAvailability([student("甲", courses)], ["甲"], 3)
    .slots[0][1];
  assert.equal(slot.busy.length, 1);
  assert.deepEqual(slot.busy[0].courses, courses);
  assert.equal(slot.free.length, 0);
});
test("maximal free blocks respect gaps, minimum duration and day boundaries", () => {
  const s = student("甲", [
    course({ startPeriod: 2, endPeriod: 3 }),
    course({ id: "b", startPeriod: 8, endPeriod: 8 }),
  ]);
  const result = analyzeAvailability([s], ["甲"], 3, 2);
  assert.equal(result.allFreeCount, 102);
  assert.deepEqual(
    result.blocks.filter((b) => b.day === 1),
    [
      { day: 1, startPeriod: 4, endPeriod: 7 },
      { day: 1, startPeriod: 9, endPeriod: 15 },
    ],
  );
  assert.equal(result.blocks.length, 8);
  assert.equal(analyzeAvailability([s], ["甲"], 3, 5).blocks.length, 7);
  assert.equal(analyzeAvailability([s], ["甲"], 3, 1).blocks.length, 9);
});
test("no selection never counts as all-free, zero denominator yields empty status", () => {
  const result = analyzeAvailability([student("甲", [course()])], [], 3);
  assert.equal(result.allFreeCount, 0);
  assert.equal(result.blocks.length, 0);
  assert.ok(
    result.slots.flat().every((c) => c.total === 0 && c.status === "empty"),
  );
});
test("missing timetable stays unknown, included in denominator and prevents false all-free", () => {
  const students = [student("甲", [course()]), student("未知", [], "manual")];
  const result = analyzeAvailability(students, ["甲", "未知"], 3);
  assert.equal(result.slots[0][0].free.length, 1);
  assert.equal(result.slots[0][0].total, 2);
  assert.equal(result.slots[0][0].status, "unknown");
  assert.equal(result.slots[0][1].busy.length, 1);
  assert.equal(result.slots[0][1].unknown.length, 1);
  assert.equal(result.allFreeCount, 0);
  assert.equal(result.blocks.length, 0);
});
test("known timetable with no classes this week and explicitly imported empty timetable are free", () => {
  const students = [student("甲", [course()]), student("已确认空课表", [])];
  const result = analyzeAvailability(
    students,
    students.map((s) => s.id),
    2,
  );
  assert.equal(result.allFreeCount, 105);
  assert.equal(result.blocks.length, 7);
  assert.ok(
    result.slots
      .flat()
      .every((c) => c.free.length === 2 && c.status === "all-free"),
  );
});
test("fully busy week has no free cells or meeting blocks", () => {
  const courses = Array.from({ length: 7 }, (_, i) =>
    course({
      id: String(i),
      day: (i + 1) as Course["day"],
      startPeriod: 1,
      endPeriod: 15,
    }),
  );
  const result = analyzeAvailability([student("甲", courses)], ["甲"], 3);
  assert.equal(result.allFreeCount, 0);
  assert.equal(result.blocks.length, 0);
  assert.ok(result.slots.flat().every((c) => c.status === "busy"));
});
test("imported lab schedule respects alternating weeks, teacher changes and period 15", () => {
  const input = readFileSync(new URL("../examples/lab-week.txt", import.meta.url), "utf8");
  const courses = coursesFromDrafts(parseTimetable(input).drafts);
  const forWeek = (week: number) => analyzeAvailability([student("甲", courses)], ["甲"], week);
  assert.equal(forWeek(2).allFreeCount, 101);
  assert.equal(forWeek(2).slots[0][1].busy[0].courses[0].teacher, "教员甲");
  assert.equal(forWeek(4).slots[0][1].busy[0].courses[0].teacher, "教员乙");
  assert.equal(forWeek(3).slots[2][4].status, "all-free");
  assert.equal(forWeek(18).slots[6][14].busy[0].courses[0].code, "LAB404");
  assert.equal(forWeek(18).allFreeCount, 104);
  assert.equal(forWeek(19).allFreeCount, 105);
});
