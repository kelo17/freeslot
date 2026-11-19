import type { Course, Student } from "./types";

export type SlotStatus = "all-free" | "partial" | "busy" | "unknown" | "empty";
export interface AvailabilitySlot {
  day: number;
  period: number;
  total: number;
  free: Student[];
  busy: { student: Student; courses: Course[] }[];
  unknown: Student[];
  status: SlotStatus;
}
export interface FreeBlock {
  day: number;
  startPeriod: number;
  endPeriod: number;
}

export function analyzeAvailability(
  students: Student[],
  selectedIds: string[],
  week: number,
  minimumPeriods = 2,
) {
  const selected = students.filter((s) => selectedIds.includes(s.id));
  const unknown = selected.filter(
    (s) => s.source === "manual" && !s.courses.length,
  );
  const known = selected.filter((s) => !unknown.includes(s));
  const slots: AvailabilitySlot[][] = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 15 }, (_, p) => {
      const free: Student[] = [],
        busy: AvailabilitySlot["busy"] = [];
      for (const student of known) {
        const courses = student.courses.filter(
          (c) =>
            c.day === d + 1 &&
            c.weeks.includes(week) &&
            c.startPeriod <= p + 1 &&
            c.endPeriod >= p + 1,
        );
        if (courses.length) busy.push({ student, courses });
        else free.push(student);
      }
      const status: SlotStatus = !selected.length
        ? "empty"
        : free.length === selected.length
          ? "all-free"
          : !free.length && !unknown.length
            ? "busy"
            : unknown.length
              ? "unknown"
              : "partial";
      return {
        day: d + 1,
        period: p + 1,
        total: selected.length,
        free,
        busy,
        unknown,
        status,
      };
    }),
  );
  const blocks: FreeBlock[] = [];
  for (const daySlots of slots) {
    let start = 0;
    for (let p = 0; p <= 15; p++) {
      if (p < 15 && daySlots[p].status === "all-free") {
        if (!start) start = p + 1;
      } else if (start) {
        if (p - start + 1 >= minimumPeriods)
          blocks.push({
            day: daySlots[0].day,
            startPeriod: start,
            endPeriod: p,
          });
        start = 0;
      }
    }
  }
  return {
    selected,
    unknown,
    slots,
    blocks,
    allFreeCount: slots.flat().filter((s) => s.status === "all-free").length,
  };
}

export const slotStyles: Record<
  SlotStatus,
  { background: string; color: string; label: string }
> = {
  "all-free": {
    background: "#d9efdd",
    color: "#205c36",
    label: "全员课表空闲",
  },
  partial: {
    background: "#fff0ca",
    color: "#745419",
    label: "部分同学课表空闲",
  },
  busy: { background: "#f9dfdc", color: "#8a3834", label: "无人课表空闲" },
  unknown: { background: "#eef0f3", color: "#626b76", label: "含未知课表" },
  empty: { background: "#f3f5f4", color: "#8b958f", label: "未选择参与人员" },
};
