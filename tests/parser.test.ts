import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseWeeks,
  parseTimetable,
  coursesFromDrafts,
  validateDraft,
} from "../src/parser.ts";

const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);
for (const [input, expected] of [
  ["2-17周单双周", range(2, 17)],
  ["2-17周单周", [3, 5, 7, 9, 11, 13, 15, 17]],
  ["2-17周双周", [2, 4, 6, 8, 10, 12, 14, 16]],
  ["11,12,13,14,15,16周", range(11, 16)],
  ["第 2 — 17 周（单周）", [3, 5, 7, 9, 11, 13, 15, 17]],
  ["1,3,3,5周", [1, 3, 5]],
  ["2-6周单周,11-14周双周", [3, 5, 12, 14]],
] as [string, number[]][])
  test(`precise weeks: ${input}`, () =>
    assert.deepEqual(parseWeeks(input), expected));
for (const input of [
  "",
  "全学期",
  "0-17周",
  "17-2周",
  "1-31周",
  "2周单周",
  "2-17周未知",
  "abc2-17周",
])
  test(`reject ambiguous/invalid weeks: ${input}`, () =>
    assert.throws(() => parseWeeks(input)));

const demo = readFileSync(
  new URL("../examples/parser-demo.md", import.meta.url),
  "utf8",
);
test("matrix: separate multiple courses and teachers, precise weeks and empty cells", () => {
  const result = parseTimetable(demo);
  assert.equal(result.drafts.length, 6);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.drafts.every((d) => validateDraft(d).length === 0));
  const courses = coursesFromDrafts(result.drafts);
  assert.equal(courses.length, 6);
  assert.deepEqual(courses[0].weeks, range(2, 17));
  assert.equal(courses[1].name, "学术写作");
  assert.equal(courses[1].code, "GS102");
  assert.equal(courses[2].day, 2);
  assert.deepEqual(courses[3].weeks, range(11, 16));
  assert.deepEqual(
    courses.slice(4).map((c) => [c.teacher, c.weeks]),
    [
      ["甲老师", [3, 5, 7]],
      ["乙老师", [9, 11, 13, 15, 17]],
    ],
  );
});
test("identical meeting unions weeks, different teachers stay separate", () => {
  const draft = parseTimetable(demo).drafts[0];
  const courses = coursesFromDrafts([
    { ...draft, weeksText: "2,4周" },
    { ...draft, id: "other", weeksText: "6周" },
    { ...draft, id: "teacher", teacher: "另一教师", weeksText: "3周" },
  ]);
  assert.equal(courses.length, 2);
  assert.deepEqual(courses[0].weeks, [2, 4, 6]);
});
test("course list supports all metadata and bare week/period columns", () => {
  const md =
    "| 课程名称 | 课程代码 | 星期 | 节次 | 上课周次 | 教师 | 地点 |\n| --- | --- | --- | --- | --- | --- | --- |\n| 研究方法 | A101 | 星期日 | 14-15 | 11,12,13 | 李老师 | A401 |";
  const result = parseTimetable(md);
  assert.equal(result.drafts.length, 1);
  assert.deepEqual(result.warnings, []);
  const c = coursesFromDrafts(result.drafts)[0];
  assert.deepEqual(
    [
      c.name,
      c.code,
      c.teacher,
      c.location,
      c.day,
      c.startPeriod,
      c.endPeriod,
      c.weeks,
    ],
    ["研究方法", "A101", "李老师", "A401", 7, 14, 15, [11, 12, 13]],
  );
});
test("unlabelled ordered fields, HTML variants and entities", () => {
  const md =
    "| 节次 | 星期一 |\n| --- | --- |\n| 1-2 | **研究方法(GS101)**<BR />GS101<br/>张老师<br>2-17周双周<br>教学楼&nbsp;201 |";
  const c = coursesFromDrafts(parseTimetable(md).drafts)[0];
  assert.equal(c.name, "研究方法");
  assert.equal(c.teacher, "张老师");
  assert.equal(c.location, "教学楼 201");
  assert.deepEqual(c.weeks, [2, 4, 6, 8, 10, 12, 14, 16]);
});
test("missing week preserved for manual repair; never whole-semester fallback", () => {
  const r = parseTimetable(
    "| 节次 | 周一 |\n| --- | --- |\n| 1-2节 | 课程名称：待核对<br>教师：李老师<br>地点：A101 |",
  );
  assert.equal(r.drafts.length, 1);
  assert.equal(r.drafts[0].weeksText, "");
  assert.ok(r.warnings.length);
  assert.throws(() => coursesFromDrafts(r.drafts));
  const fixed = { ...r.drafts[0], weeksText: "3,7周" };
  assert.deepEqual(coursesFromDrafts([fixed])[0].weeks, [3, 7]);
});
test("non-contiguous periods never fill gaps", () => {
  const r = parseTimetable(
    "| 节次 | 周六 |\n| --- | --- |\n| 1,3节 | 课程名称：讨论<br>1-2周 |",
  );
  assert.deepEqual(
    r.drafts.map((d) => [d.startPeriod, d.endPeriod]),
    [
      [1, 1],
      [3, 3],
    ],
  );
});
test("multiple bare course blocks with codes are not collapsed", () => {
  const r = parseTimetable(
    "| 节次 | 周一 |\n| --- | --- |\n| 1-2节 | 研究方法<br>GS101<br>张老师<br>2-8周<br>教学楼201<br>数理统计<br>GS102<br>王老师<br>9-17周<br>教学楼202 |",
  );
  assert.deepEqual(
    r.drafts.map((d) => [d.name, d.code, d.teacher]),
    [
      ["研究方法", "GS101", "张老师"],
      ["数理统计", "GS102", "王老师"],
    ],
  );
});
test("escaped pipes remain cell content; repeated headers supported", () => {
  const r = parseTimetable(
    "| 节次 | 周一 |\n| --- | --- |\n| 1节 | 课程名称：A\\|B<br>1周 |\n\n| 节次 | 周二 |\n| --- | --- |\n| 2节 | 课程名称：C<br>2周 |",
  );
  assert.deepEqual(
    r.drafts.map((d) => [d.name, d.day]),
    [
      ["A|B", 1],
      ["C", 2],
    ],
  );
});
test("unknown document gives explicit warnings", () => {
  assert.equal(parseTimetable("普通文本").drafts.length, 0);
  assert.ok(parseTimetable("普通文本").warnings.length);
});

const expectedMeetings = [
  ["LAB101", "纸桥实验", 1, 2, 3, [1, 2, 3], "教员甲", "教室A"],
  ["LAB101", "纸桥实验", 1, 2, 3, [4, 5, 6], "教员乙", "教室B"],
  ["LAB202", "星图测绘", 3, 5, 6, [2, 4, 6, 8], "Tutor Echo", "教室C"],
  ["LAB303", "光影记录", 5, 8, 8, [3, 7, 12], "教员丁", "教室D"],
  ["LAB404", "夜空观察", 7, 15, 15, [18], "教员戊", "教室E"],
] as [string, string, number, number, number, number[], string, string][];
for (const extension of ["txt", "md"]) {
  test(`synthetic lab timetable .${extension}: every meeting and all 3150 week/day/period slots match`, () => {
    const content = readFileSync(
      new URL(`../examples/lab-week.${extension}`, import.meta.url),
      "utf8",
    );
    const parsed = parseTimetable(content);
    assert.deepEqual(parsed.warnings, []);
    assert.equal(parsed.drafts.length, 5);
    const courses = coursesFromDrafts(parsed.drafts);
    assert.equal(new Set(courses.map((c) => c.code)).size, 4);
    const actual = courses.map((c) => [
      c.code,
      c.name,
      c.day,
      c.startPeriod,
      c.endPeriod,
      c.weeks,
      c.teacher,
      c.location,
    ]);
    assert.deepEqual(actual, expectedMeetings);
    for (let week = 1; week <= 30; week++)
      for (let day = 1; day <= 7; day++)
        for (let period = 1; period <= 15; period++) {
          const expected = expectedMeetings
            .filter(
              (r) =>
                r[2] === day &&
                r[3] <= period &&
                r[4] >= period &&
                r[5].includes(week),
            )
            .map((r) => `${r[0]}:${r[6]}:${r[7]}`)
            .sort();
          const observed = courses
            .filter(
              (c) =>
                c.day === day &&
                c.startPeriod <= period &&
                c.endPeriod >= period &&
                c.weeks.includes(week),
            )
            .map((c) => `${c.code}:${c.teacher}:${c.location}`)
            .sort();
          assert.deepEqual(
            observed,
            expected,
            `week=${week}, day=${day}, period=${period}`,
          );
        }
  });
}

test("invalid explicit schedule metadata cannot silently fall back to row/semester", () => {
  const r = parseTimetable(
    "| 节次 | 周一 |\n| --- | --- |\n| 1-2节 | 课程名称：异常课程<br>节次：20-21节<br>周次：2-17周未知 |",
  );
  assert.equal(r.drafts[0].startPeriod, 0);
  assert.equal(r.drafts[0].weeksText, "2-17周未知");
  assert.throws(() => coursesFromDrafts(r.drafts));
});

test("school clipboard tolerates wrapped titles, separate room lines and English teacher spaces", () => {
  const table = '节次\t星期一\t星期二\n2\t"LAB501【纸模型切割设\n计】\n10周  教员甲\n教学楼A\n11-13周单双周  教员乙\n教学楼A\nLAB502【色彩记录】\n3-8周单双周  Tutor Echo\n实验楼B"\t\n';
  const drafts = parseTimetable(table.replaceAll("\n", "\r\n")).drafts;
  assert.equal(drafts.length, 3);
  assert.deepEqual(drafts.map((d) => [d.name, d.teacher, d.location, d.weeksText]), [
    ["纸模型切割设计", "教员甲", "教学楼A", "10周"],
    ["纸模型切割设计", "教员乙", "教学楼A", "11-13周"],
    ["色彩记录", "Tutor Echo", "实验楼B", "3-8周"],
  ]);
  assert.ok(drafts.every((d) => !d.notes.length));
});

test("wide-spaced school fields retain unfamiliar rooms without expanding blank rows", () => {
  const parsed = parseTimetable('| 节次 | 星期一 | 星期二 |\n| --- | --- | --- |\n| 2 | LAB503【纸带编码】<br />5-8周单双周  TUTOR BLUE SKY  实践基地A | |\n| 3 | | |\n| 4 | LAB503【纸带编码】<br>5-8周单双周  TUTOR BLUE SKY  实践基地A | |');
  assert.deepEqual(parsed.drafts.map((d) => [d.teacher, d.location, d.startPeriod, d.endPeriod]), [
    ["TUTOR BLUE SKY", "实践基地A", 2, 2],
    ["TUTOR BLUE SKY", "实践基地A", 4, 4],
  ]);
});
