import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  GraduationCap,
  Info,
  LayoutGrid,
  Leaf,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { days, readData, storageKey } from "./data";
import type { Page, Student, HeatmapTarget } from "./types";
import ImportTimetable from "./ImportTimetable";
import { MAX_WEEK, formatWeeks } from "./parser";
import { analyzeAvailability } from "./availability";
import WeeklyHeatmap from "./WeeklyHeatmap";
import MeetingRecommendations from "./MeetingRecommendations";
import ExportDialog from "./ExportDialog";
import { resolveExportPlan } from "./exportModel";
import type { ExportOptions } from "./exportModel";

const pages = [
  { id: "students" as Page, label: "课表管理", icon: Users },
  { id: "overview" as Page, label: "空闲总览", icon: LayoutGrid },
  { id: "recommendations" as Page, label: "时间推荐", icon: Sparkles },
];
function App() {
  const [loaded] = useState(readData);
  const [data, setData] = useState(loaded.data);
  const [page, setPage] = useState<Page>("overview");
  const [heatmapTarget, setHeatmapTarget] = useState<HeatmapTarget | null>(
    null,
  );
  const recommendationFilters = data.recommendation || {
    selectedIds: data.students.map((s) => s.id),
    weeks: [data.week],
    duration: data.duration,
    days: [1, 2, 3, 4, 5, 6, 7],
    startPeriod: 1,
    endPeriod: 15,
  };
  const [notice, setNotice] = useState(loaded.warning);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportButton = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [importStudent, setImportStudent] = useState<
    Student | null | undefined
  >(undefined);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const studentPreview = useRef<HTMLElement>(null);
  const selected = data.students.filter((s) => data.selectedIds.includes(s.id));
  const analysis = useMemo(
    () => analyzeAvailability(data.students, data.selectedIds, data.week, data.duration),
    [data.students, data.selectedIds, data.week, data.duration],
  );
  const title = pages.find((p) => p.id === page)!.label;
  useEffect(() => {
    if (page === "students" && viewStudent) studentPreview.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [page, viewStudent]);

  useEffect(() => {
    // Storage synchronization needs success/failure feedback in the UI.
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      // oxlint-disable-next-line react/set-state-in-effect
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice(
        "保存失败：浏览器存储不可用或空间不足，本次修改仅保留在当前页面。",
      );
    }
  }, [data]);

  function toggleStudent(id: string) {
    setData((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((v) => v !== id)
        : [...prev.selectedIds, id],
    }));
  }
  function closeExport() {
    setExportOpen(false);
    requestAnimationFrame(() => exportButton.current?.focus());
  }
  async function exportQueryTable(options: ExportOptions) {
    setExporting(true);
    try {
      const plan = resolveExportPlan(data, options);
      let filename: string;
      if (options.format === "xlsx") {
        const { exportAvailabilityWorkbook } = await import("./exportWorkbook");
        filename = await exportAvailabilityWorkbook(data, plan);
      } else {
        const { exportVisual } = await import("./exportVisual");
        filename = await exportVisual(data, plan, options.format);
      }
      setNotice(`已导出 ${filename}，请在浏览器下载列表中查看。`);
      closeExport();
    } catch {
      setNotice("导出失败，未能生成查询表。请重试，或检查浏览器是否允许下载；已有课表未改变。");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="min-h-screen lg:pl-[230px]">
      {exportOpen && <ExportDialog data={data} onClose={closeExport} onExport={exportQueryTable} busy={exporting} />}
      <aside className="fixed inset-y-0 left-0 hidden w-[230px] flex-col border-r border-[#e3eae5] bg-[#fcfdfc] px-5 py-8 lg:flex">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
          className="flex items-center gap-3 px-2 text-inherit no-underline"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24775e] text-white">
            <CalendarDays size={23} />
          </span>
          <div>
            <strong className="text-xl tracking-tight">
              同频{" "}
              <span className="text-sm font-medium text-[#7a8e83]">
                FreeSlot
              </span>
            </strong>
            <p className="mt-1 text-[10px] tracking-[2px] text-[#88978e]">
              让相聚，有时间
            </p>
          </div>
        </a>
        <p className="mb-3 mt-12 px-3 text-[10px] tracking-[2px] text-[#95a29a]">
          工作空间
        </p>
        <nav className="space-y-2">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              aria-current={page === p.id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm ${page === p.id ? "bg-[#e8f2ec] font-semibold text-[#24775e]" : "text-[#6f8076] hover:bg-[#f0f5f1]"}`}
            >
              <p.icon size={18} />
              {p.label}
              {page === p.id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#24775e]" />
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-[#e3ebe5] bg-[#f4f8f4] p-4">
          <Leaf size={20} className="mb-3 text-[#5c8c70]" />
          <p className="text-xs font-semibold">少一点协调，多一点相聚</p>
          <p className="mt-2 text-[11px] leading-5 text-[#85928a]">
            课表汇聚在一起，找到属于大家的空闲时光。
          </p>
        </div>
        <div className="mt-5 flex items-center gap-2 px-2 text-[11px] text-[#8d9a92]">
          <ShieldCheck size={14} />
          数据仅保存在此浏览器
        </div>
      </aside>
      <header className="flex h-14 items-center justify-between border-b border-[#e4eae6] bg-white px-5 sm:h-[76px] md:px-9">
        <div className="flex items-center gap-2 text-xs text-[#839188]">
          <GraduationCap size={17} />
          <span className="hidden sm:inline">研究生共同空闲时间分析</span>
          <ChevronRight size={12} />
          <span className="text-[#3b5145]">{title}</span>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-[#f0f5f2] px-3 py-1.5 text-[11px] text-[#6b8173]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#62977b]" />
          本地工作空间
        </span>
      </header>
      <nav className="flex gap-2 border-b border-[#e4eae6] bg-white p-3 lg:hidden">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => setPage(p.id)}
            aria-current={page === p.id ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs ${page === p.id ? "bg-[#e8f2ec] text-[#24775e]" : "text-[#7a8b80]"}`}
          >
            <p.icon size={15} />
            {p.label}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-[1560px] p-5 md:p-9">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <span className="rounded-md border border-[#dce8df] bg-[#edf5ef] px-2 py-0.5 text-[10px] text-[#5e806b]">
                {page === "overview"
                  ? "实时分析"
                  : page === "students"
                    ? "本地课表"
                    : "实时推荐"}
              </span>
            </div>
            <p className="text-xs leading-6 text-[#819086]">
              {page === "overview"
                ? "把大家的课表放在一起，发现每一个可以相聚的时段。"
                : page === "students"
                  ? "管理参与同学与个人课表，为下一次相聚做好准备。"
                  : "从共同空闲中，找到适合组会、讨论和集体活动的时间。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="secondary"
              ref={exportButton}
              onClick={() => setExportOpen(true)}
              disabled={exporting || !saved || !data.students.length}
              title="选择导出格式与教学周范围"
              aria-busy={exporting}
            >
              <ArrowDownToLine size={16} />
              {exporting ? "正在导出…" : "导出"}
            </button>
            <button className="primary" onClick={() => setImportStudent(null)}>
              <Plus size={16} />
              添加同学
            </button>
          </div>
        </div>
        {notice && (
          <div
            role="status"
            className="mb-5 flex items-center gap-3 rounded-lg border border-[#e1e7db] bg-[#f4f7ed] p-3 text-xs"
          >
            <Info size={16} />
            <span className="flex-1">{notice}</span>
            <button aria-label="关闭提示" onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {!data.students.length && (
          <section className="panel mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h2 className="text-base font-semibold">先导入大家的课表</h2>
              <p className="mt-2 text-sm leading-6 text-[#607568]">填写姓名，粘贴课表或上传文本文件，核对后即可查看共同空闲时间。</p>
            </div>
            <button className="primary" onClick={() => setImportStudent(null)}><Plus size={16} />添加第一位同学</button>
          </section>
        )}
        {page === "students" ? (
          <>
            <div className="panel p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-semibold">
                  同学课表{" "}
                  <span className="ml-2 text-xs font-normal text-[#87968c]">
                    {data.students.length} 位同学
                  </span>
                </h2>
                <label className="flex items-center gap-2 rounded-lg border border-[#e3eae6] px-3">
                  <Search size={15} className="text-[#8b9a90]" />
                  <input
                    aria-label="搜索同学"
                    placeholder="搜索姓名或学院"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-40 bg-transparent py-2 text-xs outline-none"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.students
                  .filter((s) => `${s.name}${s.department}`.includes(search))
                  .map((s, i) => (
                    <article
                      className="rounded-xl border border-[#e3ebe6] p-5"
                      key={s.id}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} index={i} />
                        <div>
                          <h3 className="text-sm font-semibold">{s.name}</h3>
                          <p className="mt-1 text-xs text-[#87968c]">
                            {s.department}
                          </p>
                        </div>
                        <button
                          className="ml-auto p-2 text-[#9aaba0] hover:text-red-600"
                          aria-label={`删除${s.name}`}
                          onClick={() => {
                            setDeleteStudent(s);
                            deleteDialog.current?.showModal();
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <p className="my-5 text-xs text-[#75877c]">
                        {s.courses.length
                          ? `${s.courses.length} 条上课安排 · ${s.source === "demo" ? "示例课表" : "已导入"}`
                          : "尚未导入课表 · 空闲情况未知"}
                      </p>
                      <div className="flex gap-2">
                        <button
                          className="secondary flex-1"
                          onClick={() => setViewStudent(s)}
                        >
                          查看课表
                        </button>
                        <button
                          className="secondary"
                          onClick={() => setImportStudent(s)}
                        >
                          <ArrowDownToLine size={14} />
                          {s.courses.length ? "导入 / 编辑" : "导入"}
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!data.students.filter((s) =>
                `${s.name}${s.department}`.includes(search),
              ).length && (
                <p className="py-16 text-center text-sm text-[#84958a]">
                  {data.students.length
                    ? "没有匹配的同学，试试其他关键词。"
                    : "还没有同学，点击“添加同学”开始。"}
                </p>
              )}
            </div>
            {viewStudent && (
              <section ref={studentPreview} className="panel mt-5 scroll-mt-5 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {viewStudent.name}的课表
                  </h2>
                  <button
                    className="secondary"
                    onClick={() => setViewStudent(null)}
                  >
                    收起
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e6ece8] text-[#85968a]">
                        {[
                          "课程",
                          "代码",
                          "教师",
                          "星期",
                          "节次",
                          "教学周",
                          "地点",
                        ].map((h) => (
                          <th className="p-3 font-normal" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {viewStudent.courses.map((c) => (
                        <tr className="border-b border-[#eef2ef]" key={c.id}>
                          <td className="p-3">{c.name}</td>
                          <td>{c.code || "未填写"}</td>
                          <td>{c.teacher || "未填写"}</td>
                          <td>{days[c.day - 1]}</td>
                          <td>
                            {c.startPeriod}—{c.endPeriod} 节
                          </td>
                          <td>{formatWeeks(c.weeks)}</td>
                          <td>{c.location || "未填写"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!viewStudent.courses.length && (
                  <p className="py-12 text-center text-sm text-[#88998c]">
                    暂无课程，请点击“导入”粘贴或上传课表。
                  </p>
                )}
              </section>
            )}
          </>
        ) : page === "recommendations" ? (
          <MeetingRecommendations
            students={data.students}
            filters={recommendationFilters}
            onChange={(recommendation) =>
              setData((prev) => ({ ...prev, recommendation }))
            }
            onLocate={(target, ids) => {
              setData((prev) => ({
                ...prev,
                week: target.week,
                selectedIds: ids,
              }));
              setHeatmapTarget(target);
              setPage("overview");
            }}
          />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
              {[
                {
                  icon: Users,
                  label: "参与同学",
                  value: selected.length,
                  unit: "人",
                  sub: `${selected.length - analysis.unknown.length} 人已有课表${analysis.unknown.length ? ` · ${analysis.unknown.length} 人未知` : ""}`,
                  color: "#edf4ef",
                },
                {
                  icon: CalendarDays,
                  label: "全员课表空闲节次",
                  value: analysis.allFreeCount,
                  unit: "节",
                  sub: `第 ${data.week} 周 · 共 105 节`,
                  color: "#f3f2e8",
                },
                {
                  icon: Clock3,
                  label: "连续空闲时段",
                  value: analysis.blocks.length,
                  unit: "段",
                  sub: `至少连续 ${data.duration} 节 · 每段计 1 次`,
                  color: "#edf1f7",
                },
              ].map((stat) => (
                <section
                  className="panel flex items-start gap-4 p-3 sm:p-5"
                  key={stat.label}
                >
                  <span
                    style={{ background: stat.color }}
                    className="hidden rounded-xl p-3 text-[#60866f] md:block"
                  >
                    <stat.icon size={21} />
                  </span>
                  <div>
                    <p className="text-xs leading-5 text-[#63796b]">{stat.label}</p>
                    <p className="my-1.5 text-2xl font-semibold leading-8 sm:text-[28px]">
                      {stat.value}
                      <span className="ml-2 text-xs font-normal text-[#87968c]">
                        {stat.unit}
                      </span>
                    </p>
                    <p className="hidden text-xs leading-5 text-[#6c8073] sm:block">{stat.sub}</p>
                  </div>
                </section>
              ))}
            </div>
            <section className="panel mb-6 flex flex-wrap items-center gap-4 p-4">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <SlidersHorizontal size={15} />
                筛选条件
              </span>
              <span className="hidden h-5 w-px bg-[#e6ece7] sm:block" />
              <label className="flex items-center gap-3 text-xs text-[#7b8b80]">
                教学周
                <select
                  className="field !w-28"
                  value={data.week}
                  onChange={(e) =>
                    setData({ ...data, week: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: MAX_WEEK }, (_, i) => (
                    <option key={i} value={i + 1}>
                      第 {i + 1} 周
                    </option>
                  ))}
                </select>
              </label>
              {
                <label className="flex items-center gap-3 text-xs text-[#7b8b80]">
                  连续节数
                  <select
                    className="field !w-28"
                    value={data.duration}
                    onChange={(e) =>
                      setData({ ...data, duration: Number(e.target.value) })
                    }
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option value={n} key={n}>
                        {n} 节
                      </option>
                    ))}
                  </select>
                </label>
              }
              <span className="ml-auto text-[11px] text-[#84958a]">
                已选 {selected.length} / {data.students.length} 人
              </span>
            </section>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0">
                <WeeklyHeatmap
                  analysis={analysis}
                  week={data.week}
                  target={heatmapTarget}
                  onClearTarget={() => setHeatmapTarget(null)}
                  onWeek={(week) => setData((prev) => ({ ...prev, week }))}
                />{" "}
                <div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#8a988e]">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <p>
                    根据所选教学周的精确周次展开课程；未导入课表的参与者保留为未知。
                    {!!selected.filter((s) => s.source === "demo").length &&
                      " 当前选择包含示例课表，可在课表管理中替换或删除。"}
                  </p>
                </div>
              </div>
              <div className="contents xl:block xl:space-y-5">
                <section className="panel order-first min-w-0 p-5 xl:order-none">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">参与同学</h2>
                    <button
                      className="text-[11px] text-[#3b8563] hover:underline"
                      onClick={() =>
                        setData({
                          ...data,
                          selectedIds:
                            selected.length === data.students.length
                              ? []
                              : data.students.map((s) => s.id),
                        })
                      }
                    >
                      {selected.length === data.students.length &&
                      data.students.length
                        ? "取消全选"
                        : "全选"}
                    </button>
                  </div>
                  <div className="grid max-h-28 grid-cols-2 gap-2 overflow-y-auto sm:max-h-40 xl:max-h-[340px] xl:grid-cols-1">
                    {data.students.map((s, i) => (
                      <label
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 hover:bg-[#f4f8f5]"
                        key={s.id}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[#24775e]"
                          checked={data.selectedIds.includes(s.id)}
                          onChange={() => toggleStudent(s.id)}
                        />
                        <span className="hidden sm:contents"><Avatar name={s.name} index={i} small /></span>
                        <span className="flex-1 text-xs">{s.name}</span>
                        <span className="hidden text-[11px] text-[#6c8073] sm:inline">
                          {s.courses.length ? s.department : "未导入"}
                        </span>
                      </label>
                    ))}
                  </div>
                  {!data.students.length && (
                    <p className="py-4 text-xs text-[#87998c]">
                      添加同学后可选择参与人员。
                    </p>
                  )}
                  <button
                    className="mt-5 flex w-full items-center justify-center gap-2 border-t border-[#eaf0eb] pt-4 text-[11px] text-[#698573]"
                    onClick={() => setPage("students")}
                  >
                    管理所有课表
                    <ArrowRight size={13} />
                  </button>
                </section>
                {page === "overview" && (
                  <section className="panel order-last p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <Clock3 size={16} />
                      <h2 className="text-sm font-semibold">连续空闲时段</h2>
                    </div>
                    <p className="mb-4 text-xs leading-6 text-[#708677]">
                      至少连续 {data.duration} 节，每段计 1
                      次；按节次连续，不跨星期。
                    </p>
                    {analysis.blocks.length ? (
                      <div className="space-y-2">
                        {analysis.blocks.slice(0, 7).map((b) => (
                          <div
                            key={`${b.day}-${b.startPeriod}`}
                            className="rounded-lg bg-[#e8f4e9] p-3 text-xs text-[#336347]"
                          >
                            <strong>
                              {days[b.day - 1]} · 第 {b.startPeriod}—
                              {b.endPeriod} 节
                            </strong>
                            <span className="mt-1 block">
                              全员课表空闲 · {b.endPeriod - b.startPeriod + 1}{" "}
                              节
                            </span>
                          </div>
                        ))}
                        {analysis.blocks.length > 7 && (
                          <p className="text-xs text-[#708677]">
                            另有 {analysis.blocks.length - 7}{" "}
                            段，可在绿色区域查看。
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="py-3 text-xs leading-6 text-[#849387]">
                        {analysis.unknown.length
                          ? "请补全未知课表后确认共同空闲时段。"
                          : "没有满足条件的连续时段。可切换教学周、减少连续节数，或调整参与人员。"}
                      </p>
                    )}
                  </section>
                )}{" "}
              </div>
            </div>
          </>
        )}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#e3eae5] pt-5 text-[10px] text-[#9aa59d]">
          <span>
            同频 FreeSlot <span className="mx-2">/</span>为每一次相聚留出时间
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCheck size={13} />
            {saved ? "数据已保存至此浏览器" : "数据未保存"}
          </span>
        </footer>
      </main>
      {importStudent !== undefined && (
        <ImportTimetable
          student={importStudent}
          onClose={() => setImportStudent(undefined)}
          onSave={(student) => {
            setData((prev) => ({
              ...prev,
              students: prev.students.some((s) => s.id === student.id)
                ? prev.students.map((s) => (s.id === student.id ? student : s))
                : [...prev.students, student],
              selectedIds: prev.students.some((s) => s.id === student.id)
                ? prev.selectedIds
                : [...prev.selectedIds, student.id],
              recommendation: prev.recommendation
                ? {
                    ...prev.recommendation,
                    selectedIds: !prev.students.some((s) => s.id === student.id)
                      ? [...prev.recommendation.selectedIds, student.id]
                      : prev.recommendation.selectedIds,
                  }
                : undefined,
            }));
            setViewStudent(student);
            setSearch("");
            setPage("students");
            setImportStudent(undefined);
            setNotice(
              student.courses.length
                ? `${student.name}的课表已保存，共 ${student.courses.length} 条上课安排。`
                : `已添加${student.name}，暂无课表，暂不计入空闲统计。`,
            );
          }}
        />
      )}
      <dialog ref={deleteDialog} aria-labelledby="delete-student-title">
        <h2 id="delete-student-title" className="text-lg font-semibold">
          删除同学
        </h2>
        <p className="my-5 text-sm leading-6 text-[#7c8d80]">
          确定删除{deleteStudent?.name}及其课表？删除后无法撤销。
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="secondary"
            onClick={() => deleteDialog.current?.close()}
          >
            取消
          </button>
          <button
            className="primary !bg-[#a84f49]"
            onClick={() => {
              if (!deleteStudent) return;
              const id = deleteStudent.id;
              setData((prev) => ({
                ...prev,
                students: prev.students.filter((s) => s.id !== id),
                selectedIds: prev.selectedIds.filter((v) => v !== id),
                recommendation: prev.recommendation
                  ? {
                      ...prev.recommendation,
                      selectedIds: prev.recommendation.selectedIds.filter(
                        (v) => v !== id,
                      ),
                    }
                  : undefined,
              }));
              if (viewStudent?.id === id) setViewStudent(null);
              setNotice(`已删除${deleteStudent.name}及其课表。`);
              deleteDialog.current?.close();
              setDeleteStudent(null);
            }}
          >
            确认删除
          </button>
        </div>
      </dialog>
    </div>
  );
}

function Avatar({
  name,
  index,
  small = false,
}: {
  name: string;
  index: number;
  small?: boolean;
}) {
  const colors = ["#e7efe3", "#f3e9df", "#e5edf2", "#ece6f3"];
  return (
    <span
      style={{ background: colors[index % colors.length] }}
      className={`flex shrink-0 items-center justify-center rounded-full text-[#728170] ${small ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-sm"}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}
export default App;
