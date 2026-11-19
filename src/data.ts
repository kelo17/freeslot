import type { AppData } from "./types";

export const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export const periodLabels = Array.from({ length: 15 }, (_, index) =>
  index < 5 ? "上午" : index < 11 ? "下午" : "晚上",
);
export function initialData(): AppData {
  return {
    version: 1,
    students: [],
    selectedIds: [],
    week: 2,
    duration: 2,
  };
}

export const storageKey = "freeslot:data:v1";

export function readData(): { data: AppData; warning: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { data: initialData(), warning: "" };
    const data = JSON.parse(raw) as AppData;
    if (
      data.version !== 1 ||
      !Array.isArray(data.students) ||
      !Array.isArray(data.selectedIds) ||
      !Number.isInteger(data.week) ||
      data.week < 1 ||
      data.week > 30 ||
      !Number.isInteger(data.duration) ||
      data.duration < 1 ||
      data.duration > 4 ||
      !data.students.every(
        (s) =>
          typeof s.id === "string" &&
          typeof s.name === "string" &&
          typeof s.department === "string" &&
          ["demo", "manual", "imported"].includes(s.source) &&
          (s.importText === undefined || typeof s.importText === "string") &&
          Array.isArray(s.courses) &&
          s.courses.every(
            (c) =>
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              [c.code, c.teacher, c.location, c.sourceText].every(
                (v) => v === undefined || typeof v === "string",
              ) &&
              Number.isInteger(c.day) &&
              c.day >= 1 &&
              c.day <= 7 &&
              Number.isInteger(c.startPeriod) &&
              c.startPeriod >= 1 &&
              Number.isInteger(c.endPeriod) &&
              c.endPeriod >= c.startPeriod &&
              c.endPeriod <= 15 &&
              Array.isArray(c.weeks) &&
              c.weeks.every((w) => Number.isInteger(w) && w >= 1 && w <= 30),
          ),
      ) ||
      new Set(data.students.map((s) => s.id)).size !== data.students.length ||
      !data.selectedIds.every(
        (id) =>
          typeof id === "string" && data.students.some((s) => s.id === id),
      )
    ) {
      throw new Error("Invalid stored data");
    }
    const r = data.recommendation;
    if (r !== undefined) {
      const inRange = (v: number, min: number, max: number) =>
        Number.isInteger(v) && v >= min && v <= max;
      if (
        !r ||
        !Array.isArray(r.selectedIds) ||
        !r.selectedIds.every((id) => typeof id === "string") ||
        !Array.isArray(r.weeks) ||
        !r.weeks.every((w) => inRange(w, 1, 30)) ||
        !Array.isArray(r.days) ||
        !r.days.every((d) => inRange(d, 1, 7)) ||
        !inRange(r.duration, 1, 15) ||
        !inRange(r.startPeriod, 1, 15) ||
        !inRange(r.endPeriod, 1, 15)
      ) {
        delete data.recommendation;
        return {
          data,
          warning: "推荐筛选条件无法读取，已恢复默认条件；已有课表仍保留。",
        };
      }
      r.selectedIds = r.selectedIds.filter((id) =>
        data.students.some((s) => s.id === id),
      );
    }
    return { data, warning: "" };
  } catch {
    let backedUp = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        localStorage.setItem(`${storageKey}:unreadable:${Date.now()}`, raw);
        backedUp = true;
      }
    } catch { /* Storage errors are also reported by the save feedback. */ }
    return {
      data: initialData(),
      warning: `本地数据无法读取${backedUp ? "，原始内容已在浏览器中备份" : ""}。请重新导入课表，并检查浏览器存储设置。`,
    };
  }
}
