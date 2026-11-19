import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Check, ChevronLeft, X } from "lucide-react";
import type { AppData } from "./types";
import { resolveExportPlan } from "./exportModel";
import type { ExportFormat, ExportOptions, ExportScope } from "./exportModel";

export default function ExportDialog({ data, onClose, onExport, busy }: {
  data: AppData; onClose: () => void; onExport: (options: ExportOptions) => Promise<void>; busy: boolean;
}) {
  const [format, setFormat] = useState<ExportFormat | null>(null);
  const [scope, setScope] = useState<ExportScope>("current");
  const [start, setStart] = useState(data.week);
  const [end, setEnd] = useState(Math.min(30, data.week + 3));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const options: ExportOptions = { format: format || "pdf", scope, startWeek: start, endWeek: end };
  let error = "";
  let plan;
  try { plan = resolveExportPlan(data, options); } catch (e) { error = e instanceof Error ? e.message : "周次无效"; }
  return <dialog ref={dialog} onCancel={(e) => { if (busy) e.preventDefault(); else onClose(); }} className="export-dialog" aria-labelledby="export-title">
    <div className="flex items-center justify-between gap-4">
      <div><p className="mb-1 text-[10px] tracking-[2px] text-[#7b9387]">同频 FREESLOT</p><h2 id="export-title" className="text-xl font-semibold">{format ? "选择导出周次" : "导出"}</h2></div>
      <button className="secondary !p-2" aria-label="关闭导出" disabled={busy} onClick={onClose}><X size={18} /></button>
    </div>
    {!format ? <>
      <p className="mb-5 mt-3 text-sm leading-6 text-[#708479]">把已保存的课表变成便于查看和分享的空闲查询表。</p>
      <div className="grid grid-cols-2 gap-3">
        {([ ["pdf", "适合阅读与打印", "含空闲图、可约时间、课表明细"], ["png", "清晰无损图片", "每周空闲图，多周自动排布"], ["jpg", "便于微信分享", "每周空闲图，图片体积更小"], ["xlsx", "表格筛选与核对", "含空闲图、可约时间、课表明细"] ] as const).map(([value, subtitle, detail]) => <button key={value} className="export-format" onClick={() => setFormat(value)}>
          <strong className="text-base text-[#24775e]">导出成{value}</strong><span className="mt-3 block text-xs text-[#41594c]">{subtitle}</span><span className="mt-1 block text-[11px] leading-5 text-[#809187]">{detail}</span>
        </button>)}
      </div>
    </> : <>
      <button className="my-4 flex items-center gap-1 text-xs text-[#24775e]" disabled={busy} onClick={() => setFormat(null)}><ChevronLeft size={14} />更换格式 · {format.toUpperCase()}</button>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="sr-only">导出范围</legend>
        {([ ["current", "导出本周", `第${data.week}周`], ["range", "导出x-x周", "选择起止周次"], ["all", "导出全部", ""] ] as const).map(([value, title, detail]) => <label key={value} className={`export-scope ${scope === value ? "export-scope-selected" : ""}`}>
          <input type="radio" name="export-scope" value={value} checked={scope === value} onChange={() => setScope(value)} />
          <span className="flex-1"><strong className="block text-sm">{title}</strong>{detail && <span className="mt-1 block text-xs text-[#7b8d82]">{detail}</span>}</span>{scope === value && <Check size={17} className="text-[#24775e]" />}
        </label>)}
        {scope === "range" && <div className="grid grid-cols-2 gap-3 px-1 py-2">
          <label className="text-xs text-[#6b8173]">开始周<select aria-label="导出开始周" className="field mt-2" value={start} onChange={(e) => setStart(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>第{i + 1}周</option>)}</select></label>
          <label className="text-xs text-[#6b8173]">结束周<select aria-label="导出结束周" className="field mt-2" value={end} onChange={(e) => setEnd(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>第{i + 1}周</option>)}</select></label>
        </div>}
      </fieldset>
      <div className="my-5 rounded-xl bg-[#f2f6f3] p-4 text-xs leading-6 text-[#627b6b]" aria-live="polite">
        {error ? <span className="text-[#b44343]">{error}</span> : <>
          <p className="font-semibold text-[#315640]">全部{data.students.length}位同学 · {plan!.label} · 共{plan!.weeks.length}周</p>
        </>}
      </div>
      <button className="primary w-full" disabled={busy || !!error} aria-busy={busy} onClick={() => { void onExport(options); }}><ArrowDownToLine size={16} />{busy ? "正在生成…" : `确认导出${format.toUpperCase()}`}</button>
    </>}
  </dialog>;
}
