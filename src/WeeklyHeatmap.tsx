import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { days, periodLabels } from "./data";
import { MAX_WEEK, formatWeeks } from "./parser";
import { slotStyles } from "./availability";
import type { analyzeAvailability } from "./availability";
import type { HeatmapTarget } from "./types";

export default function WeeklyHeatmap({
  analysis,
  week,
  onWeek,
  target,
  onClearTarget,
}: {
  analysis: ReturnType<typeof analyzeAvailability>;
  week: number;
  onWeek: (week: number) => void;
  target?: HeatmapTarget | null;
  onClearTarget?: () => void;
}) {
  const [position, setPosition] = useState<{
    day: number;
    period: number;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const activeTarget = target?.week === week ? target : null;
  useEffect(() => {
    if (!target || target.week !== week) return;
    const cell = table.current?.querySelector<HTMLButtonElement>(
      `[data-day="${target.day}"][data-period="${target.startPeriod}"]`,
    );
    cell?.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "instant",
    });
    cell?.focus({ preventScroll: true });
  }, [target, week]);
  const slot = position
    ? analysis.slots[position.day - 1][position.period - 1]
    : null;
  function close() {
    setPosition(null);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!position) return;
    closeButton.current?.focus();
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPosition(null);
        trigger.current?.focus();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [position]);

  return (
    <section className="panel overflow-hidden">
      {activeTarget && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 border-b border-[#c5dfcc] bg-[#e8f4eb] p-4 text-xs text-[#286b42]"
        >
          <span>
            已定位推荐：第 {week} 周 · {days[activeTarget.day - 1]} · 第{" "}
            {activeTarget.startPeriod}—{activeTarget.endPeriod} 节（边框高亮）
          </span>
          <button className="shrink-0 underline" onClick={onClearTarget}>
            清除高亮
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1ee] px-5 py-5">
        <div>
          <h2 className="text-sm font-semibold">一周空闲热力图</h2>
          <p className="mt-2 text-xs text-[#6b8173]">
            优先找浅绿色区域 · 数字表示空闲人数 / 参与人数
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            className="secondary !p-2"
            aria-label="上一周"
            disabled={week === 1}
            onClick={() => onWeek(week - 1)}
          >
            <ChevronLeft size={15} />
          </button>
          <strong>第 {week} 周</strong>
          <button
            className="secondary !p-2"
            aria-label="下一周"
            disabled={week === MAX_WEEK}
            onClick={() => onWeek(week + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-4 text-xs">
        {(["all-free", "partial", "busy", "unknown"] as const).map((status) => (
          <span className="flex items-center gap-2" key={status}>
            <span
              className="h-3.5 w-3.5 rounded border border-black/5"
              style={{ background: slotStyles[status].background }}
            />
            {slotStyles[status].label}
          </span>
        ))}
      </div>
      {(!analysis.selected.length || analysis.unknown.length > 0) && (
        <p
          role="status"
          className="mx-5 mt-4 rounded-lg bg-[#f4f5f7] p-3 text-xs leading-6 text-[#65717b]"
        >
          {!analysis.selected.length
            ? "请在参与同学中勾选至少一人，查看共同空闲时间。"
            : `${analysis.unknown.length} 位同学尚未导入课表。分母包含所有参与者，未知人员不会计为空闲，也不会生成全员空闲时段。`}
        </p>
      )}
      <div className="overflow-x-auto p-3 sm:p-5">
        <table
          ref={table}
          className="w-full min-w-[560px] table-fixed border-separate [border-spacing:5px_5px]"
        >
          <caption className="sr-only">
            第 {week} 周共同空闲课表，每格显示课表空闲人数占所选参与人数
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="w-[78px] pb-3 text-left text-xs font-normal text-[#728579]"
              >
                节次
              </th>
              {days.map((day, i) => (
                <th
                  scope="col"
                  className="pb-3 text-xs font-medium text-[#50685a]"
                  key={day}
                >
                  星期{"一二三四五六日"[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodLabels.map((label, p) => (
              <tr key={p + 1}>
                <th scope="row" className="text-left font-normal">
                  <span className="block text-xs text-[#4c6858]">
                    第 {p + 1} 节
                  </span>
                  {[1, 5, 6, 11, 12, 15].includes(p + 1) && (
                    <span className="block text-[11px] text-[#819287]">
                      {label}
                    </span>
                  )}
                </th>
                {analysis.slots.map((daySlots, d) => {
                  const cell = daySlots[p],
                    style = slotStyles[cell.status];
                  return (
                    <td key={d}>
                      <button
                        className="heat-cell !min-h-9 font-semibold sm:!min-h-10"
                        data-status={cell.status}
                        data-day={d + 1}
                        data-period={p + 1}
                        data-highlighted={
                          !!activeTarget &&
                          activeTarget.day === d + 1 &&
                          p + 1 >= activeTarget.startPeriod &&
                          p + 1 <= activeTarget.endPeriod
                        }
                        style={{
                          background: style.background,
                          color: style.color,
                          boxShadow:
                            activeTarget &&
                            activeTarget.day === d + 1 &&
                            p + 1 >= activeTarget.startPeriod &&
                            p + 1 <= activeTarget.endPeriod
                              ? "inset 0 0 0 3px #246f49"
                              : undefined,
                          outline:
                            position?.day === d + 1 && position.period === p + 1
                              ? "2px solid #24775e"
                              : undefined,
                        }}
                        aria-label={`${days[d]}第${p + 1}节：${cell.free.length}/${cell.total}人课表空闲，${style.label}`}
                        aria-controls="slot-detail"
                        aria-expanded={
                          position?.day === d + 1 && position.period === p + 1
                        }
                        onClick={(e) => {
                          trigger.current = e.currentTarget;
                          setPosition({ day: d + 1, period: p + 1 });
                        }}
                      >
                        {cell.total ? `${cell.free.length}/${cell.total}` : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#edf1ee] px-5 py-4 text-xs leading-6 text-[#687f71]">
        课表空闲仅表示该教学周没有课程安排，不代表同学实际上没有其他安排。会议前请向参与者确认。
        <span className="mt-1 block text-[11px] text-[#89998d]">
          第1—5节为上午，第6—11节为下午，第12—15节为晚上；手机可左右滑动查看完整一周。
        </span>
      </div>
      {slot && (
        <aside
          id="slot-detail"
          aria-label="时段详情"
          className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[400px] flex-col border-l border-[#dce7de] bg-white shadow-[-12px_0_40px_#173b2920]"
        >
          <div className="flex items-start justify-between border-b border-[#e6ece7] p-5">
            <div>
              <p className="mb-2 text-xs text-[#6c8475]">
                第 {week} 周 · 时段详情
              </p>
              <h2 className="text-lg font-semibold">
                星期{"一二三四五六日"[slot.day - 1]} · 第 {slot.period} 节
              </h2>
              <p className="mt-2 text-xs text-[#73897b]">
                {slot.free.length}/{slot.total} 人课表空闲 ·{" "}
                {slotStyles[slot.status].label}
              </p>
            </div>
            <button
              ref={closeButton}
              className="secondary !p-2"
              aria-label="关闭时段详情"
              onClick={close}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#316442]">
                课表空闲{" "}
                <span className="ml-1 text-xs">{slot.free.length} 人</span>
              </h3>
              {slot.free.length ? (
                <div className="flex flex-wrap gap-2">
                  {slot.free.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-lg bg-[#e7f3e9] px-3 py-2 text-xs text-[#316442]"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#86958b]">暂无</p>
              )}
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#8a4942]">
                有课同学{" "}
                <span className="ml-1 text-xs">{slot.busy.length} 人</span>
              </h3>
              {slot.busy.length ? (
                <div className="space-y-3">
                  {slot.busy.map(({ student, courses }) => (
                    <article
                      key={student.id}
                      className="rounded-xl border border-[#ecdcd8] bg-[#fffaf9] p-3"
                    >
                      <h4 className="text-sm font-semibold">{student.name}</h4>
                      {courses.map((c) => (
                        <div
                          key={c.id}
                          className="mt-3 border-t border-[#efe5e1] pt-3 text-xs leading-6"
                        >
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-[#7d8279]">
                            {c.code || "代码未填写"} · 第 {c.startPeriod}—
                            {c.endPeriod} 节
                          </p>
                          <p className="text-[#7d8279]">
                            教师：{c.teacher || "未填写"}
                          </p>
                          <p className="text-[#7d8279]">
                            地点：{c.location || "未填写"}
                          </p>
                          <p className="text-[#7d8279]">
                            周次：{formatWeeks(c.weeks)}
                          </p>
                          {student.source === "demo" && (
                            <p className="text-[#a18856]">示例课表</p>
                          )}
                        </div>
                      ))}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#86958b]">暂无</p>
              )}
            </section>
            {!!slot.unknown.length && (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-[#65717b]">
                  课表未知 · {slot.unknown.length} 人
                </h3>
                <p className="text-xs leading-6 text-[#65717b]">
                  {slot.unknown.map((s) => s.name).join("、")}
                  <br />
                  尚未导入课表，无法判断此时段是否空闲。
                </p>
              </section>
            )}
          </div>
          <p className="border-t border-[#e6ece7] bg-[#f6f9f6] p-5 text-xs leading-6 text-[#6f8376]">
            课表空闲不等于实际可参加，请确认其他安排。按 Esc 或点击右上角关闭。
          </p>
        </aside>
      )}
    </section>
  );
}
