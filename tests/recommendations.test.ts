import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendMeetings, meetingText } from "../src/recommendations.ts";
import type { Course, Student, RecommendationFilters } from "../src/types.ts";
const c = (patch: Partial<Course> = {}): Course => ({
  id: "c",
  name: "冲突课程",
  code: "C101",
  teacher: "教师",
  location: "教室",
  day: 1,
  startPeriod: 2,
  endPeriod: 2,
  weeks: [2],
  ...patch,
});
const s = (
  id: string,
  courses: Course[],
  source: Student["source"] = "imported",
): Student => ({ id, name: id, department: "学院", source, courses });
const f = (
  patch: Partial<RecommendationFilters> = {},
): RecommendationFilters => ({
  selectedIds: ["甲", "乙"],
  weeks: [2],
  duration: 2,
  days: [1],
  startPeriod: 1,
  endPeriod: 4,
  ...patch,
});
test("checks the whole consecutive window, not only the first period", () => {
  const result = recommendMeetings([s("甲", [c()]), s("乙", [])], f());
  assert.equal(result[0].startPeriod, 3);
  assert.equal(result[0].free.length, 2);
  const first = result.find((r) => r.startPeriod === 1)!;
  assert.equal(first.free.length, 1);
  assert.equal(first.byWeek[0].busy[0].courses[0].id, "c");
});
test("different free students across adjacent periods cannot be summed as available attendees", () => {
  const result = recommendMeetings(
    [s("甲", [c({ startPeriod: 1, endPeriod: 1 })]), s("乙", [c()])],
    f({ endPeriod: 2 }),
  );
  assert.deepEqual(result, []);
});
test("fixed all-week full-attendance slots rank before full attendance in only some weeks", () => {
  const result = recommendMeetings(
    [s("甲", [c({ weeks: [3], startPeriod: 1, endPeriod: 1 })]), s("乙", [])],
    f({ weeks: [2, 3], duration: 1, startPeriod: 1, endPeriod: 2 }),
  );
  assert.equal(result[0].startPeriod, 2);
  assert.equal(result[0].fixedAll, true);
  assert.deepEqual(result[0].applicableWeeks, [2, 3]);
  assert.deepEqual(result[1].applicableWeeks, [2]);
  assert.equal(result[1].fixedAll, false);
});
test("fallback prioritizes highest confirmed participant count, then same-cohort week coverage", () => {
  const students = [
    s("甲", [c({ weeks: [2, 3], startPeriod: 1, endPeriod: 2 })]),
    s("乙", [c({ weeks: [3], startPeriod: 1, endPeriod: 1 })]),
    s("丙", []),
  ];
  const result = recommendMeetings(
    students,
    f({
      selectedIds: ["甲", "乙", "丙"],
      weeks: [2, 3],
      duration: 1,
      endPeriod: 2,
    }),
  );
  assert.equal(result[0].startPeriod, 2);
  assert.deepEqual(result[0].applicableWeeks, [2, 3]);
  assert.equal(result[0].free.length, 2);
  assert.equal(result[1].free.length, 2);
  assert.deepEqual(result[1].applicableWeeks, [2]);
});
test("rotating weekly participants never become one recurring group", () => {
  const result = recommendMeetings(
    [s("甲", [c({ weeks: [2] })]), s("乙", [c({ weeks: [3] })])],
    f({ weeks: [2, 3], duration: 1, startPeriod: 2, endPeriod: 2 }),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].free.length, 1);
  assert.equal(result[0].applicableWeeks.length, 1);
  assert.equal(result[0].fixedAll, false);
});
test("allowed weekdays and full period range strictly constrain starts and ends", () => {
  const result = recommendMeetings(
    [s("甲", []), s("乙", [])],
    f({ days: [5, 7], duration: 3, startPeriod: 13, endPeriod: 15 }),
  );
  assert.deepEqual(
    result.map((r) => [r.day, r.startPeriod, r.endPeriod]),
    [
      [5, 13, 15],
      [7, 13, 15],
    ],
  );
});
test("empty selections, inverted ranges and too-short windows have no recommendations", () => {
  for (const patch of [
    { selectedIds: [] },
    { weeks: [] },
    { days: [] },
    { startPeriod: 4, endPeriod: 2 },
    { duration: 5 },
  ] as Partial<RecommendationFilters>[])
    assert.deepEqual(
      recommendMeetings([s("甲", []), s("乙", [])], f(patch)),
      [],
    );
});
test("unknown timetable is never counted free or allowed to produce full-attendance result", () => {
  const result = recommendMeetings([s("甲", []), s("乙", [], "manual")], f());
  assert.equal(result[0].total, 2);
  assert.equal(result[0].free.length, 1);
  assert.equal(result[0].fixedAll, false);
  assert.equal(result[0].byWeek[0].unknown[0].id, "乙");
  assert.deepEqual(
    recommendMeetings([s("甲", [], "manual"), s("乙", [], "manual")], f()),
    [],
  );
});
test("week filtering and overlapping conflicts preserve exact courses without counting student twice", () => {
  const students = [
    s("甲", [
      c({ weeks: [3, 5] }),
      c({ id: "second", weeks: [3], teacher: "第二教师" }),
    ]),
    s("乙", []),
  ];
  assert.equal(
    recommendMeetings(students, f({ weeks: [2], endPeriod: 2 }))[0].free.length,
    2,
  );
  const r = recommendMeetings(students, f({ weeks: [3], endPeriod: 2 }))[0];
  assert.equal(r.free.length, 1);
  assert.equal(r.byWeek[0].busy.length, 1);
  assert.equal(r.byWeek[0].busy[0].courses.length, 2);
});
test("copy text includes applicable weeks, fixed cohort, grouped course conflicts and unknowns", () => {
  const result = recommendMeetings(
    [s("甲", [c({ weeks: [2, 3] })]), s("乙", []), s("未知", [], "manual")],
    f({ selectedIds: ["甲", "乙", "未知"], weeks: [2, 3], endPeriod: 2 }),
  )[0];
  const text = meetingText(result);
  assert.match(text, /星期一 第1—2节/);
  assert.match(text, /第2、3周/);
  assert.match(text, /1\/3人（乙）/);
  assert.match(text, /冲突（第2、3周）：甲：冲突课程（C101）/);
  assert.match(text, /课表未知：未知/);
  assert.doesNotMatch(text, /确认其他安排|请核对冲突/);
});
test("equivalent filter orders produce deterministic ranking and applicable week order", () => {
  const students = [s("甲", []), s("乙", [])];
  assert.deepEqual(
    recommendMeetings(students, f({ weeks: [3, 2, 3], days: [2, 1, 2] })),
    recommendMeetings(students, f({ weeks: [2, 3], days: [1, 2] })),
  );
});

test("imported lab timetable supports recurring meetings and alternating teachers", async () => {
  const { readFileSync } = await import("node:fs");
  const { parseTimetable, coursesFromDrafts } =
    await import("../src/parser.ts");
  const courses = coursesFromDrafts(
    parseTimetable(
      readFileSync(
        new URL("../examples/lab-week.txt", import.meta.url),
        "utf8",
      ),
    ).drafts,
  );
  const students = [s("甲", courses), s("乙", [])];
  const fixed = recommendMeetings(
    students,
    f({ weeks: [2, 10, 18], days: [4], duration: 3, endPeriod: 5 }),
  );
  assert.equal(fixed.length, 3);
  assert.ok(fixed.every((r) => r.fixedAll && r.free.length === 2));
  const conflicted = recommendMeetings(
    students,
    f({ weeks: [2, 4], days: [1], startPeriod: 2, endPeriod: 3 }),
  )[0];
  assert.equal(conflicted.free.length, 1);
  assert.deepEqual(conflicted.applicableWeeks, [2, 4]);
  assert.equal(conflicted.byWeek[0].busy[0].courses[0].name, "纸桥实验");
  assert.equal(conflicted.byWeek[0].busy[0].courses[0].teacher, "教员甲");
  assert.equal(conflicted.byWeek[1].busy[0].courses[0].name, "纸桥实验");
  assert.equal(conflicted.byWeek[1].busy[0].courses[0].teacher, "教员乙");
  assert.match(meetingText(conflicted), /第2周.*纸桥实验/);
  assert.match(meetingText(conflicted), /第4周.*纸桥实验/);
});
