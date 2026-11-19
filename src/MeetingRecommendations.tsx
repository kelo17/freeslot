import { useState } from "react";
import { Copy, ArrowRight, Sparkles } from "lucide-react";
import { days } from "./data";
import { MAX_WEEK } from "./parser";
import { meetingText, recommendMeetings } from "./recommendations";
import type { HeatmapTarget, RecommendationFilters, Student } from "./types";

export default function MeetingRecommendations({
  students,
  filters,
  onChange,
  onLocate,
}: {
  students: Student[];
  filters: RecommendationFilters;
  onChange: (f: RecommendationFilters) => void;
  onLocate: (target: HeatmapTarget, ids: string[]) => void;
}) {
  const [limit, setLimit] = useState(12);
  const [copyStatus, setCopyStatus] = useState("");
  const [manualText, setManualText] = useState("");
  const [moreWeeks, setMoreWeeks] = useState(filters.weeks.some((w) => w > 18));
  const results = recommendMeetings(students, filters);
  const selected = students.filter((s) => filters.selectedIds.includes(s.id));
  const fixedCount = results.filter((r) => r.fixedAll).length;
  const allCount = results.filter((r) => r.free.length === r.total).length;
  function change(patch: Partial<RecommendationFilters>) {
    onChange({ ...filters, ...patch });
    setLimit(12);
    setCopyStatus("");
    setManualText("");
  }
  function toggle(
    field: "selectedIds" | "weeks" | "days",
    value: string | number,
  ) {
    if (field === "selectedIds")
      change({
        selectedIds: filters.selectedIds.includes(String(value))
          ? filters.selectedIds.filter((v) => v !== value)
          : [...filters.selectedIds, String(value)],
      });
    else
      change({
        [field]: filters[field].includes(Number(value))
          ? filters[field].filter((v) => v !== value)
          : [...filters[field], Number(value)].sort((a, b) => a - b),
      });
  }

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h2 className="mb-5 text-sm font-semibold">会议条件</h2>
        <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
          <fieldset>
            <legend className="mb-3 text-xs font-semibold">
              参与同学 · {selected.length}/{students.length} 人
            </legend>
            <button
              className="mb-3 text-xs text-[#24775e]"
              onClick={() =>
                change({
                  selectedIds:
                    selected.length === students.length
                      ? []
                      : students.map((s) => s.id),
                })
              }
            >
              {selected.length === students.length && students.length
                ? "取消全选"
                : "全选"}
            </button>
            <div className="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto xl:max-h-64 xl:grid-cols-1">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-[#f4f8f5]"
                >
                  <input
                    type="checkbox"
                    className="accent-[#24775e]"
                    checked={filters.selectedIds.includes(s.id)}
                    onChange={() => toggle("selectedIds", s.id)}
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="hidden text-xs text-[#6c8073] sm:inline">
                    {s.source === "manual" && !s.courses.length
                      ? "课表未知"
                      : s.source === "demo"
                        ? "示例课表"
                        : "已导入"}
                  </span>
                </label>
              ))}
            </div>
            {!students.length && (
              <p className="text-xs text-[#819286]">请先添加同学并导入课表。</p>
            )}
          </fieldset>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-3 text-xs font-semibold">
                教学周（可多选） · 已选 {filters.weeks.length} 周
              </legend>
              <div className="mb-3 flex gap-4 text-xs text-[#24775e]">
                <button
                  onClick={() =>
                    change({
                      weeks: Array.from({ length: 18 }, (_, i) => i + 1),
                    })
                  }
                >
                  选择第1—18周
                </button>
                <button onClick={() => change({ weeks: [] })}>清空</button>
                <button aria-expanded={moreWeeks} onClick={() => setMoreWeeks(!moreWeeks)}>{moreWeeks ? "收起第19—30周" : "更多周次"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: moreWeeks ? MAX_WEEK : 18 }, (_, i) => i + 1).map((w) => (
                  <label
                    key={w}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${filters.weeks.includes(w) ? "border-[#a4cdb0] bg-[#e8f4ea] text-[#2e6742]" : "border-[#e1e8e3] text-[#7c8c81]"}`}
                  >
                    <input
                      type="checkbox"
                      className="accent-[#24775e]"
                      checked={filters.weeks.includes(w)}
                      onChange={() => toggle("weeks", w)}
                    />
                    第{w}周
                  </label>
                ))}
              </div>
              {!moreWeeks && filters.weeks.some((w) => w > 18) && <p className="mt-2 text-xs text-[#54745e]">另已选择：第 {filters.weeks.filter((w) => w > 18).join("、")} 周</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-xs font-semibold">
                允许开会的星期
              </legend>
              <div className="flex flex-wrap gap-3">
                {days.map((day, i) => (
                  <label
                    key={day}
                    className="flex min-h-10 cursor-pointer items-center gap-1.5 text-xs"
                  >
                    <input
                      type="checkbox"
                      className="accent-[#24775e]"
                      checked={filters.days.includes(i + 1)}
                      onChange={() => toggle("days", i + 1)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-4">
              <label className="text-xs">
                连续占用节数
                <select
                  className="field mt-2 !w-32"
                  value={filters.duration}
                  onChange={(e) => change({ duration: Number(e.target.value) })}
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} 节
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                允许开始节次
                <select
                  className="field mt-2 !w-32"
                  value={filters.startPeriod}
                  onChange={(e) =>
                    change({ startPeriod: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      第 {n} 节
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                允许结束节次
                <select
                  className="field mt-2 !w-32"
                  value={filters.endPeriod}
                  onChange={(e) =>
                    change({ endPeriod: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      第 {n} 节
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
      <div
        role="status"
        className="rounded-xl border border-[#dce8df] bg-[#f0f6f1] p-4 text-xs leading-6 text-[#54745e]"
      >
        {!selected.length
          ? "请至少选择一位同学。"
          : !filters.weeks.length
            ? "请至少选择一个教学周。"
            : !filters.days.length
              ? "请至少选择一个允许的星期。"
              : filters.startPeriod > filters.endPeriod
                ? "开始节次不能大于结束节次。"
                : filters.duration > filters.endPeriod - filters.startPeriod + 1
                  ? "允许的节次范围不足以容纳会议时长。"
                  : fixedCount
                    ? `找到 ${fixedCount} 个在所有所选教学周均全员空闲的固定时段，优先展示。`
                    : allCount
                      ? `没有跨全部所选周的全员固定时段；找到 ${allCount} 个部分教学周全员空闲的时段。`
                      : results.length
                        ? "没有全员空闲时段，以下按可参加人数最多、适用周次最多推荐替代方案。"
                        : "没有可推荐的完整时段。试试更换教学周、缩短会议时长，或放宽星期和节次范围。"}
        <details className="mt-1"><summary className="cursor-pointer">如何排序与计算</summary><p>跨全部周全员空闲优先，再按空闲人数、覆盖周次数排序。人数按同一组人在整段会议均无课计算；未知课表不计为空闲。</p></details>
      </div>
      {copyStatus && (
        <p role="status" className="text-xs text-[#24775e]">
          {copyStatus}
        </p>
      )}
      {manualText && (
        <label className="block text-xs">
          可手动复制以下会议文本
          <textarea
            readOnly
            className="field mt-2 min-h-40"
            value={manualText}
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={17} />
          <h2 className="text-sm font-semibold">推荐时间</h2>
          <span className="text-xs text-[#839589]">
            共 {results.length} 个候选
          </span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {results.slice(0, limit).map((r, i) => (
            <article
              key={r.id}
              className={`panel p-5 ${r.fixedAll ? "!border-[#a9ceb3]" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs text-[#829388]">
                  推荐 {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs ${r.free.length === r.total ? "bg-[#e3f1e6] text-[#316e46]" : "bg-[#fff0ca] text-[#826222]"}`}
                >
                  {r.fixedAll
                    ? "全部所选周 · 全员空闲"
                    : r.free.length === r.total
                      ? "适用周全员空闲"
                      : "替代方案"}
                </span>
              </div>
              <button
                className="w-full text-left"
                onClick={() =>
                  onLocate(
                    {
                      day: r.day,
                      startPeriod: r.startPeriod,
                      endPeriod: r.endPeriod,
                      week: r.applicableWeeks[0],
                    },
                    filters.selectedIds,
                  )
                }
                aria-label={`定位${days[r.day - 1]}第${r.startPeriod}至${r.endPeriod}节`}
              >
                <h3 className="text-lg font-semibold">
                  {days[r.day - 1]} · 第 {r.startPeriod}—{r.endPeriod} 节
                </h3>
                <p className="my-3 text-sm text-[#347047]">
                  {r.free.length}/{r.total} 人课表空闲{" "}
                  <span className="text-xs text-[#849589]">
                    · 覆盖 {r.applicableWeeks.length}/{r.requestedWeeks.length}{" "}
                    周
                  </span>
                </p>
                <p className="text-xs leading-6 text-[#728b79]">
                  适用教学周：第 {r.applicableWeeks.join("、")} 周
                </p>
                <p className="text-xs leading-6 text-[#728b79]">
                  可参加：{r.free.map((s) => s.name).join("、")}
                </p>
              </button>
              {r.byWeek.some((w) => w.busy.length || w.unknown.length) && (
                <details className="mt-3 text-xs text-[#86745a]">
                  <summary className="cursor-pointer">
                    所选周内冲突 / 未知：
                    {[
                      ...new Set(
                        r.byWeek.flatMap((w) => [
                          ...w.busy.map((b) => b.student.name),
                          ...w.unknown.map((s) => s.name),
                        ]),
                      ),
                    ].join("、")}
                    （展开课程）
                  </summary>
                  <div className="mt-2 space-y-2 rounded-lg bg-[#faf7f1] p-3">
                    {r.byWeek
                      .filter((w) => w.busy.length || w.unknown.length)
                      .map((w) => (
                        <div key={w.week}>
                          <strong>
                            第 {w.week} 周
                            {r.applicableWeeks.includes(w.week)
                              ? "（适用周）"
                              : "（其他所选周）"}
                          </strong>
                          {w.busy.map(({ student, courses }) => (
                            <p className="mt-1 leading-6" key={student.id}>
                              {student.name}：
                              {courses
                                .map(
                                  (c) =>
                                    `${c.name}${c.code ? `（${c.code}）` : ""} · 第${c.startPeriod}—${c.endPeriod}节`,
                                )
                                .join("；")}
                            </p>
                          ))}
                          {!!w.unknown.length && (
                            <p className="leading-6">
                              课表未知：
                              {w.unknown.map((s) => s.name).join("、")}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </details>
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8eee9] pt-4">
                <button
                  className="secondary"
                  onClick={() =>
                    onLocate(
                      {
                        day: r.day,
                        startPeriod: r.startPeriod,
                        endPeriod: r.endPeriod,
                        week: r.applicableWeeks[0],
                      },
                      filters.selectedIds,
                    )
                  }
                >
                  <ArrowRight size={14} />
                  在热力图中查看
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const text = meetingText(r);
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopyStatus("会议时间已复制，可粘贴到微信群。");
                      setManualText("");
                    } catch {
                      setCopyStatus(
                        "浏览器暂不允许自动复制，请手动复制下方文本。",
                      );
                      setManualText(text);
                    }
                  }}
                >
                  <Copy size={14} />
                  复制会议时间
                </button>
              </div>
            </article>
          ))}
        </div>
        {results.length > limit && (
          <button
            className="secondary mt-5"
            onClick={() => setLimit((n) => n + 12)}
          >
            显示更多推荐（剩余 {results.length - limit} 个）
          </button>
        )}
      </section>
      <p className="text-xs leading-6 text-[#85948b]">
        课表空闲不代表没有其他安排，请在会议前确认。连续节次按课表顺序计算，未计入课间与午休。
      </p>
    </div>
  );
}
