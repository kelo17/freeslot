import ExcelJS from "exceljs";
import type { AppData } from "./types.ts";
import { analyzeAvailability, slotStyles } from "./availability.ts";
import { recommendMeetings } from "./recommendations.ts";
import { formatWeeks } from "./parser.ts";
import { chooseWeekLayout, resolveExportPlan, exportFilename, exportTimestamp } from "./exportModel.ts";
import type { ExportPlan } from "./exportModel.ts";
import { downloadBlob } from "./download.ts";

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const green = "24775E";
const text = "253B35";

function mergedLine(sheet: ExcelJS.Worksheet, row: number, columns: number, value: string, size = 11, startColumn = 1) {
  sheet.mergeCells(row, startColumn, row, startColumn + columns - 1);
  const cell = sheet.getCell(row, startColumn);
  cell.value = value;
  cell.font = { name: "Microsoft YaHei", size, color: { argb: text }, bold: size > 11 };
  cell.alignment = { vertical: "middle", wrapText: true };
  const width = sheet.columns.slice(startColumn - 1, startColumn + columns - 1).reduce((sum, col) => sum + (col.width || 10), 0);
  sheet.getRow(row).height = Math.max(sheet.getRow(row).height || 0, Math.min(409, Math.max(26, Math.ceil(value.length * 1.8 / width) * 18 + 8)));
}

function header(sheet: ExcelJS.Worksheet, row: number, values: string[], startColumn = 1) {
  sheet.getRow(row).height = 30;
  values.forEach((value, i) => {
    const cell = sheet.getCell(row, startColumn + i);
    cell.value = value;
    cell.font = { name: "Microsoft YaHei", size: 11, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function tableRow(sheet: ExcelJS.Worksheet, values: (string | number)[], fill?: string) {
  const row = sheet.addRow(values);
  let lines = 1;
  row.eachCell((cell, column) => {
    cell.font = { name: "Microsoft YaHei", size: 11, color: { argb: text } };
    cell.alignment = { vertical: "middle", wrapText: true, horizontal: typeof cell.value === "number" ? "right" : "left" };
    if (typeof cell.value === "number") cell.numFmt = "0";
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    const value = String(cell.value ?? "");
    lines = Math.max(lines, ...value.split("\n").map((line) => Math.ceil(line.length * 1.8 / (sheet.getColumn(column).width || 12))));
  });
  row.height = Math.min(409, Math.max(30, lines * 18 + 10));
  return row;
}

/** A static snapshot of ALL saved students. Never reads or replaces browser storage. */
export function buildAvailabilityWorkbook(data: AppData, exportedAt = new Date(), requestedPlan?: ExportPlan) {
  if (!data.students.length) throw new Error("请先添加同学并保存课表，再导出查询表。");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FreeSlot";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;
  const names = data.students.map((s) => s.name).join("、");
  const ids = data.students.map((s) => s.id);
  const unknown = data.students.filter((s) => s.source === "manual" && !s.courses.length);
  const plan = requestedPlan || resolveExportPlan(data, { format: "xlsx", scope: "all", startWeek: 1, endWeek: 30 });
  const stamp = exportTimestamp(exportedAt);
  const context = `参与人员：全部已保存同学（${ids.length}人） ${names}`;
  const weeks = plan.weeks;
  const intro = `导出时间：${stamp}`;

  const heatmap = workbook.addWorksheet("每周空闲图", { properties: { tabColor: { argb: green } } });
  const layout = chooseWeekLayout(weeks.length);
  const totalColumns = layout.columns * 9 - 1;
  heatmap.columns = Array.from({ length: totalColumns }, (_, i) => ({ width: i % 9 === 8 ? 3 : i % 9 === 0 ? 9 : 9 }));
  heatmap.views = [{ showGridLines: false, zoomScale: layout.columns === 3 ? 70 : 90 }];
  heatmap.pageSetup = { paperSize: 9, orientation: layout.columns > 1 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  mergedLine(heatmap, 1, totalColumns, "同频 FreeSlot · 每周空闲图", 16);
  mergedLine(heatmap, 2, totalColumns, `${intro} ${plan.label}，共${weeks.length}周。`);
  mergedLine(heatmap, 3, totalColumns, context);
  heatmap.getRow(4).height = 4;
  mergedLine(heatmap, 5, totalColumns, "空闲人数 / 总人数。绿：全员空闲；黄：部分空闲；红：无人空闲；灰：含未知。");
  if (unknown.length) mergedLine(heatmap, 6, totalColumns, `课表未知：${unknown.map((s) => s.name).join("、")}`);
  else heatmap.getRow(6).height = 4;
  for (const [index, week] of weeks.entries()) {
    const row = 8 + Math.floor(index / layout.columns) * 20;
    const column = 1 + index % layout.columns * 9;
    const analysis = analyzeAvailability(data.students, ids, week, 2);
    mergedLine(heatmap, row, 8, `第 ${week} 周    全员空闲 ${analysis.allFreeCount} 节`, 12, column);
    heatmap.getCell(row, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E8F2EC" } };
    if (index && index % (layout.columns * 2) === 0) heatmap.getRow(row).addPageBreak();
    header(heatmap, row + 1, ["节次", ...weekdays], column);
    for (let p = 0; p < 15; p++) {
      const r = heatmap.getRow(row + 2 + p);
      r.height = 25;
      r.getCell(column).value = `${p < 5 ? "上午" : p < 11 ? "下午" : "晚上"} ${p + 1}`;
      r.getCell(column).font = { name: "Microsoft YaHei", size: 10, color: { argb: text } };
      r.getCell(column).alignment = { horizontal: "center", vertical: "middle" };
      for (let d = 0; d < 7; d++) {
        const slot = analysis.slots[d][p];
        const cell = r.getCell(column + d + 1);
        cell.value = `${slot.free.length}/${slot.total}${slot.unknown.length ? "\n含未知" : ""}`;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: slotStyles[slot.status].background.slice(1).toUpperCase() } };
        cell.font = { name: "Microsoft YaHei", size: 10, bold: true, color: { argb: slotStyles[slot.status].color.slice(1).toUpperCase() } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        if (p === 4 || p === 10) cell.border = { bottom: { style: "medium", color: { argb: "FFFFFF" } } };
      }
      if (unknown.length) r.height = 34;
    }
  }

  const windows = workbook.addWorksheet("连续2节可约时间", { properties: { tabColor: { argb: green } } });
  windows.columns = [8, 8, 15, 13, 28, 40].map((width) => ({ width }));
  windows.views = [{ state: "frozen", ySplit: 6, xSplit: 2, showGridLines: false }];
  windows.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:6" };
  mergedLine(windows, 1, 6, "同频 FreeSlot · 连续2节可约时间", 16);
  mergedLine(windows, 2, 6, `${intro} · ${plan.label}`);
  mergedLine(windows, 3, 6, context);
  windows.getRow(4).height = 4;
  windows.getRow(5).height = 4;
  header(windows, 6, ["教学周", "星期", "连续节次", "空闲/总人数", "两节均空闲人员", "有课 / 课表未知"]);
  for (const week of weeks) {
    const candidates = recommendMeetings(data.students, {
      selectedIds: ids, weeks: [week], duration: 2, days: [1, 2, 3, 4, 5, 6, 7], startPeriod: 1, endPeriod: 15,
    });
    if (!candidates.length) {
      tableRow(windows, [week, "—", "无可约窗口", `0/${ids.length}`, "无人确认连续两节空闲", unknown.length ? `未知：${unknown.map((s) => s.name).join("、")}` : "所有连续2节窗口均有课程冲突"], "EEF0F3");
    }
    for (const result of candidates) {
      const first = result.byWeek[0];
      const conflicts = first.busy.map(({ student, courses }) => `${student.name}：${courses.map((c) => `${c.name}（第${c.startPeriod}—${c.endPeriod}节）`).join("、")}`);
      if (first.unknown.length) conflicts.push(`未知：${first.unknown.map((s) => s.name).join("、")}`);
      tableRow(windows, [week, weekdays[result.day - 1], `第${result.startPeriod}—${result.endPeriod}节`, `${result.free.length}/${result.total}`, result.free.map((s) => s.name).join("、"), conflicts.join("\n") || "全员课表空闲"], result.fixedAll ? "D9EFDD" : first.unknown.length ? "EEF0F3" : "FFF0CA");
    }
  }
  for (let r = 7; r <= windows.rowCount; r++) {
    for (let c = 1; c <= 4; c++) windows.getCell(r, c).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  }
  windows.autoFilter = { from: { row: 6, column: 1 }, to: { row: windows.rowCount, column: 6 } };

  const details = workbook.addWorksheet("课表明细");
  details.columns = [16, 18, 30, 18, 10, 12, 12, 26, 18, 28, 22].map((width) => ({ width }));
  details.views = [{ state: "frozen", ySplit: 5, xSplit: 1, showGridLines: false }];
  mergedLine(details, 1, 11, "同频 FreeSlot · 课表明细", 16);
  mergedLine(details, 2, 11, `${intro} ${plan.label}。`);
  details.getRow(3).height = 4;
  details.getRow(4).height = 4;
  header(details, 5, ["姓名", "学院", "课程", "课程代码", "星期", "开始节次", "结束节次", "实际教学周", "教师", "地点", "课表状态"]);
  for (const student of data.students) {
    const selectedCourses = student.courses.filter((c) => c.weeks.some((w) => weeks.includes(w)));
    const source = student.source === "demo" ? "示例课表" : student.source === "imported" ? "已导入" : "手动保存";
    if (!selectedCourses.length) {
      tableRow(details, [student.name, student.department || "—", "—", "—", "—", "—", "—", "—", "—", "—", student.source === "manual" && !student.courses.length ? "课表未知（未导入）" : `${source}（所选周段无课）`], "EEF0F3");
    }
    for (const course of selectedCourses) {
      tableRow(details, [student.name, student.department || "—", course.name, course.code || "—", weekdays[course.day - 1], course.startPeriod, course.endPeriod, formatWeeks(course.weeks.filter((w) => weeks.includes(w))), course.teacher || "—", course.location || "—", source]);
    }
  }
  details.autoFilter = { from: { row: 5, column: 1 }, to: { row: details.rowCount, column: 11 } };
  return { workbook, filename: exportFilename(plan, "xlsx", exportedAt) };
}

export async function exportAvailabilityWorkbook(data: AppData, plan?: ExportPlan) {
  const { workbook, filename } = buildAvailabilityWorkbook(data, new Date(), plan);
  const bytes = await workbook.xlsx.writeBuffer();
  // Copy to an ordinary ArrayBuffer for DOM Blob compatibility.
  const blob = new Blob([new Uint8Array(bytes).buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
  return filename;
}
