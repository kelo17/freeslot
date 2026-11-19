import type { AppData } from "./types.ts";
import { slotStyles } from "./availability.ts";
import { buildExportWeeks, chooseWeekLayout, exportFilename, exportTimestamp, weekdays } from "./exportModel.ts";
import type { ExportFormat, ExportPlan, ExportWeek } from "./exportModel.ts";
import { formatWeeks } from "./parser.ts";
import { downloadBlob } from "./download.ts";

const font = '"Microsoft YaHei", "PingFang SC", sans-serif';
const ink = "#244237", muted = "#758b80", green = "#24775e";
const cardWidth = 560, cardHeight = 666, gap = 24, padding = 32;
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 12) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = color; ctx.fill();
}
function write(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size = 18, color = ink, bold = false, align: CanvasTextAlign = "left") {
  ctx.font = `${bold ? 600 : 400} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle"; ctx.fillText(value, x, y);
}
function wrap(ctx: CanvasRenderingContext2D, value: string, width: number, size: number) {
  ctx.font = `400 ${size}px ${font}`;
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    let line = "";
    for (const c of paragraph) {
      if (ctx.measureText(line + c).width > width && line) { lines.push(line); line = c; } else line += c;
    }
    lines.push(line);
  }
  return lines;
}
function canvas(width: number, height: number, scale = 1) {
  const element = document.createElement("canvas");
  element.width = Math.ceil(width * scale); element.height = Math.ceil(height * scale);
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("浏览器无法绘制导出图片，请换用现代浏览器。");
  ctx.scale(scale, scale); ctx.fillStyle = "#f4f7f5"; ctx.fillRect(0, 0, width, height);
  return { element, ctx };
}
function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, week: ExportWeek) {
  rounded(ctx, x, y, cardWidth, cardHeight, "#ffffff", 18);
  write(ctx, `第 ${week.week} 周`, x + 22, y + 32, 26, ink, true);
  write(ctx, `${week.analysis.allFreeCount} 节全员空闲`, x + cardWidth - 22, y + 33, 16, muted, false, "right");
  ctx.fillStyle = "#e7eeea"; ctx.fillRect(x + 22, y + 60, cardWidth - 44, 1);
  const left = x + 22, labelWidth = 48, cellWidth = (cardWidth - 44 - labelWidth) / 7;
  for (let d = 0; d < 7; d++) write(ctx, weekdays[d], left + labelWidth + cellWidth * (d + 0.5), y + 84, 17, d > 4 ? "#a07950" : muted, true, "center");
  for (let p = 0; p < 15; p++) {
    const top = y + 104 + p * 29 + (p >= 11 ? 20 : p >= 5 ? 10 : 0);
    write(ctx, String(p + 1).padStart(2, "0"), left + 22, top + 13, 16, muted, false, "center");
    for (let d = 0; d < 7; d++) {
      const slot = week.analysis.slots[d][p], style = slotStyles[slot.status], cx = left + labelWidth + d * cellWidth;
      rounded(ctx, cx + 2, top, cellWidth - 4, 26, style.background, 5);
      write(ctx, `${slot.free.length}/${slot.total}`, cx + cellWidth / 2, top + 13, `${slot.free.length}/${slot.total}`.length > 5 ? 13 : 16, style.color, true, "center");
    }
  }
  write(ctx, "01—05 上午     06—11 下午     12—15 晚上", left, y + 584, 13, muted);
  ctx.fillStyle = "#e7eeea"; ctx.fillRect(left, y + 606, cardWidth - 44, 1);
  const best = week.meetings[0];
  write(ctx, "连续2节 · 优先时段", left, y + 628, 14, muted);
  write(ctx, best ? `${weekdays[best.day - 1]} 第${best.startPeriod}—${best.endPeriod}节 · ${best.free.length}/${best.total}人课表空闲` : "暂无确认可约时间", x + cardWidth - 22, y + 648, 16, best?.fixedAll ? green : ink, true, "right");
}
export function renderWeekAtlas(data: AppData, plan: ExportPlan, weeks: ExportWeek[], exportedAt = new Date(), forceColumns?: number) {
  const columns = forceColumns || chooseWeekLayout(weeks.length).columns, rows = Math.ceil(weeks.length / columns);
  const width = padding * 2 + columns * cardWidth + (columns - 1) * gap, measuring = canvas(width, 100);
  const names = wrap(measuring.ctx, `参与人员（${data.students.length}人）：${data.students.map((s) => s.name).join("、")}`, width - padding * 2, 18);
  const headerHeight = 184 + names.length * 25;
  const footer = [
    "空闲人数 / 总人数",
    `导出时间：${exportTimestamp(exportedAt)}`,
  ];
  const height = headerHeight + rows * cardHeight + (rows - 1) * gap + 30 + footer.length * 20;
  const { element, ctx } = canvas(width, height, weeks.length <= 4 ? 2 : weeks.length <= 12 ? 1.25 : 1);
  write(ctx, "同频 FreeSlot", padding, 40, 16, green, true);
  write(ctx, "共同空闲时间", padding, 83, 36, ink, true);
  write(ctx, `${plan.label} · ${plan.weeks.length}个教学周`, width - padding, 116, 17, muted, false, "right");
  let y = 144;
  names.forEach((line) => { write(ctx, line, padding, y, 18); y += 25; });
  [["#d9efdd", "全员空闲"], ["#fff0ca", "部分空闲"], ["#f9dfdc", "无人空闲"], ["#eef0f3", "含未知"]].forEach(([color, label], i) => {
    rounded(ctx, padding + i * 136, y + 5, 14, 14, color, 4); write(ctx, label, padding + i * 136 + 22, y + 12, 15, muted);
  });
  weeks.forEach((week, i) => drawCard(ctx, padding + i % columns * (cardWidth + gap), headerHeight + Math.floor(i / columns) * (cardHeight + gap), week));
  footer.forEach((line, i) => write(ctx, line, padding, height - 14 - (footer.length - 1 - i) * 20, 14, muted));
  measuring.element.width = 0;
  return element;
}
function imageBlob(element: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => element.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败，请缩小周次范围后重试。")), type, 0.94));
}
type TableRow = (string | number)[];
function* tablePages(title: string, subtitle: string, headings: string[], widths: number[], rows: TableRow[]) {
  let current = canvas(1440, 1018, 1.5), y = 183;
  const startPage = () => {
    write(current.ctx, "同频 FreeSlot", 38, 35, 18, green, true);
    write(current.ctx, title, 38, 82, 34, ink, true); write(current.ctx, subtitle, 38, 121, 17, muted);
    let x = 38;
    headings.forEach((label, i) => { rounded(current.ctx, x, 145, widths[i], 38, green, 0); write(current.ctx, label, x + 12, 164, 19, "#fff", true); x += widths[i]; });
    y = 183;
  };
  startPage();
  for (const [index, row] of rows.entries()) {
    const lines = row.map((value, i) => wrap(current.ctx, String(value), widths[i] - 24, 19));
    let consumed = 0;
    const count = Math.max(...lines.map((v) => v.length));
    while (consumed < count) {
      const needed = (count - consumed) * 26 + 16;
      if ((needed <= 770 && y + needed > 945) || y > 900) { yield current.element; current = canvas(1440, 1018, 1.5); startPage(); }
      const fits = Math.max(1, Math.min(count - consumed, Math.floor((945 - y - 16) / 26))), rowHeight = fits * 26 + 16;
      let x = 38;
      lines.forEach((values, i) => {
        current.ctx.fillStyle = index % 2 ? "#ffffff" : "#eaf1ed"; current.ctx.fillRect(x, y, widths[i], rowHeight);
        const part = values.slice(consumed, consumed + fits);
        if (consumed && i === 0 && !part.length) part.push(`${row[0]}（续）`);
        part.forEach((line, k) => write(current.ctx, line, x + 12, y + 21 + k * 26, 19)); x += widths[i];
      });
      y += rowHeight; consumed += fits;
    }
  }
  yield current.element;
}
export async function exportVisual(data: AppData, plan: ExportPlan, format: Exclude<ExportFormat, "xlsx">) {
  await document.fonts.ready;
  const exportedAt = new Date(), weeks = buildExportWeeks(data, plan), filename = exportFilename(plan, format, exportedAt);
  if (format === "png" || format === "jpg") {
    const element = renderWeekAtlas(data, plan, weeks, exportedAt);
    downloadBlob(await imageBlob(element, format === "png" ? "image/png" : "image/jpeg"), filename); element.width = 0; return filename;
  }
  const { PDFDocument } = await import("pdf-lib"), pdf = await PDFDocument.create();
  pdf.setTitle(`同频空闲查询 ${plan.label}`); pdf.setCreator("FreeSlot");
  const addPage = async (element: HTMLCanvasElement) => {
    const image = await pdf.embedPng(await (await imageBlob(element, "image/png")).arrayBuffer());
    const page = pdf.addPage(element.height > element.width ? [595.28, 841.89] : [841.89, 595.28]);
    const ratio = Math.min(page.getWidth() / element.width, (page.getHeight() - 20) / element.height), w = element.width * ratio, h = element.height * ratio;
    page.drawImage(image, { x: (page.getWidth() - w) / 2, y: 20 + (page.getHeight() - 20 - h) / 2, width: w, height: h });
    page.drawText(`${pdf.getPageCount()}`, { x: page.getWidth() - 32, y: 8, size: 9 }); element.width = 0;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };
  for (let i = 0; i < weeks.length; i += 2) await addPage(renderWeekAtlas(data, plan, weeks.slice(i, i + 2), exportedAt, Math.min(2, weeks.length - i)));
  const meetings: TableRow[] = [];
  for (const week of weeks) {
    if (!week.meetings.length) meetings.push([week.week, "—", "无可约时间", `0/${data.students.length}`, "无人确认连续两节空闲", week.analysis.unknown.length ? `未知：${week.analysis.unknown.map((s) => s.name).join("、")}` : "均存在课程冲突"]);
    for (const r of week.meetings) {
      const first = r.byWeek[0], conflicts = first.busy.map(({ student, courses }) => `${student.name}：${courses.map((c) => `${c.name}（第${c.startPeriod}—${c.endPeriod}节）`).join("、")}`);
      if (first.unknown.length) conflicts.push(`未知：${first.unknown.map((s) => s.name).join("、")}`);
      meetings.push([week.week, weekdays[r.day - 1], `第${r.startPeriod}—${r.endPeriod}节`, `${r.free.length}/${r.total}`, r.free.map((s) => s.name).join("、"), conflicts.join("\n") || "全员课表空闲"]);
    }
  }
  for (const element of tablePages("连续2节可约时间", `${plan.label} · ${data.students.length}人`, ["教学周", "星期", "连续节次", "空闲/总人数", "两节均空闲人员", "冲突 / 未知"], [95, 95, 160, 150, 380, 484], meetings)) await addPage(element);
  const details: TableRow[] = [];
  for (const student of data.students) {
    const courses = student.courses.filter((c) => c.weeks.some((w) => plan.weeks.includes(w)));
    if (!courses.length) details.push([student.name, student.source === "manual" && !student.courses.length ? "课表未知" : "所选周段无课", "—", "—", "—", "—"]);
    for (const c of courses) details.push([student.name, `${c.name}${c.code ? `（${c.code}）` : ""}${student.source === "demo" ? "（示例）" : ""}`, weekdays[c.day - 1], `第${c.startPeriod}—${c.endPeriod}节`, formatWeeks(c.weeks.filter((w) => plan.weeks.includes(w))), `${c.teacher || "—"}\n${c.location || "—"}`]);
  }
  for (const element of tablePages("课表明细", plan.label, ["姓名", "课程（代码）", "星期", "节次", "教学周", "教师 / 地点"], [160, 420, 95, 160, 249, 280], details)) await addPage(element);
  downloadBlob(new Blob([new Uint8Array(await pdf.save()).buffer], { type: "application/pdf" }), filename); return filename;
}
