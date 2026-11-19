import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Plus, Trash2, X } from "lucide-react";
import { days } from "./data";
import {
  coursesFromDrafts,
  draftFromCourse,
  parseTimetable,
  parseWeeks,
  validateDraft,
} from "./parser";
import type { CourseDraft } from "./parser";
import type { Student } from "./types";
import sampleTimetable from "../examples/lab-week.txt?raw";

export default function ImportTimetable({
  student,
  onClose,
  onSave,
}: {
  student: Student | null;
  onClose: () => void;
  onSave: (s: Student) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLElement>(null);
  const request = useRef(0);
  const [name, setName] = useState(student?.name || "");
  const [department, setDepartment] = useState(student?.department || "");
  const [text, setText] = useState(student?.importText || "");
  const [drafts, setDrafts] = useState<CourseDraft[] | null>(
    student?.courses.length ? student.courses.map(draftFromCourse) : null,
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const errors =
    drafts?.flatMap((d, i) =>
      validateDraft(d).map((e) => `第 ${i + 1} 条：${e}`),
    ) || [];

  useEffect(() => {
    dialog.current?.showModal();
    nameInput.current?.focus();
  }, []);

  function parse(content = text, message = "") {
    if (!content.trim()) {
      setDrafts(null);
      setWarnings([]);
      setError("请先粘贴课表或上传文件。");
      return;
    }
    const result = parseTimetable(content);
    setDrafts(result.drafts);
    setWarnings(message ? [message, ...result.warnings] : result.warnings);
    setError(result.drafts.length ? "" : "未识别到课程。请检查表头是否包含星期与节次，并保留课程名称和上课周次；也可载入示例对照格式。");
    requestAnimationFrame(() => preview.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function update(id: string, patch: Partial<CourseDraft>) {
    setDrafts(
      (prev) => prev?.map((d) => (d.id === id ? { ...d, ...patch } : d)) || [],
    );
  }
  function save(nameOnly = false) {
    if (!name.trim()) {
      setError("请填写同学姓名。");
      nameInput.current?.focus();
      return;
    }
    if (!nameOnly && (!drafts?.length || errors.length)) {
      setError("请先解析课表，并修正所有必填字段。");
      return;
    }
    const courses = nameOnly ? [] : coursesFromDrafts(drafts!);
    onSave({
      id: student?.id || crypto.randomUUID(),
      name: name.trim(),
      department: department.trim() || "未填写学院",
      source: courses.length ? "imported" : "manual",
      courses,
      importText: text,
    });
  }

  return (
    <dialog
      ref={dialog}
      className="import-dialog"
      aria-labelledby="import-title"
      onCancel={onClose}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 id="import-title" className="text-lg font-semibold">
            {student ? `${student.name} · 导入与编辑课表` : "添加同学与课表"}
          </h2>
          <p className="mt-2 text-xs text-[#72877a]">
            粘贴或上传 → 解析预览 → 核对并保存
          </p>
        </div>
        <button aria-label="关闭导入窗口" className="p-2" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs">
          姓名 <span className="text-red-600">*</span>
          <input
            ref={nameInput}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="请输入同学姓名"
            className="field mt-2"
          />
        </label>
        <label className="text-xs">
          学院（可选）
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            maxLength={60}
            placeholder="如：设计学院"
            className="field mt-2"
          />
        </label>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="markdown-input" className="text-sm font-semibold">
          粘贴课表
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={loading}
            className="secondary"
            onClick={() => {
              setText(sampleTimetable);
              parse(sampleTimetable, "已载入虚构的示例课表，可编辑后保存。");
            }}
          >
            载入课表示例
          </button>
          <button
            disabled={loading}
            className="secondary"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp size={15} />
            {loading ? "读取中…" : "上传 .md / .txt"}
          </button>
        </div>
      </div>
      <input
        ref={fileInput}
        aria-label="上传课表文件"
        type="file"
        accept=".md,.txt,text/plain,text/markdown"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const token = ++request.current;
          if (!/\.(md|txt)$/i.test(file.name)) {
            setError("仅支持 .md、.txt 文件。");
            return;
          }
          if (file.size > 2 * 1024 * 1024) {
            setError("课表文件超过 2 MB，请使用较小的文本文件。");
            return;
          }
          setLoading(true);
          setError("");
          try {
            const bytes = await file.arrayBuffer();
            let content: string;
            let encoding = "UTF-8";
            try {
              content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            } catch {
              content = new TextDecoder("gb18030", { fatal: true }).decode(
                bytes,
              );
              encoding = "GB18030";
            }
            if (token !== request.current) return;
            const cleanText = content.replace(/^\uFEFF/, "");
            setText(cleanText);
            parse(cleanText, `已读取并解析 ${file.name}（${encoding}），请核对后保存。`);
          } catch {
            if (token === request.current)
              setError("文件读取失败，请使用 UTF-8 文本或直接粘贴课表。");
          } finally {
            if (token === request.current) setLoading(false);
          }
        }}
      />
      <textarea
        id="markdown-input"
        value={text}
        disabled={loading}
        onChange={(e) => {
          setText(e.target.value);
          setDrafts(null);
          setWarnings([]);
          setError("");
        }}
        className="field min-h-40 resize-y font-mono text-xs leading-6"
        placeholder={
          "| 节次 | 周一 | 周二 |\n| --- | --- | --- |\n| 1-2节 | 课程名称：研究方法<br>课程代码：GS101<br>教师：李老师<br>2-17周单周<br>地点：教学楼201 | |"
        }
      />
      <div className="my-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] leading-5 text-[#72877a]">
          支持直接复制教务课表或 Excel 表格，也支持 Markdown；请保留制表符、单元格引号和换行。数据仅存本地。
        </p>
        <button
          className="primary"
          onClick={() => parse()}
          disabled={loading || !text.trim()}
        >
          {drafts?.length ? "重新解析" : "解析课表"}
        </button>
      </div>
      {!!warnings.length && (
        <div
          role="status"
          className="my-4 rounded-lg bg-[#f3f7ef] p-3 text-xs leading-6 text-[#657f60]"
        >
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      {drafts !== null && (
        <section ref={preview} className="mt-6 scroll-mt-4 border-t border-[#e4ece6] pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">
                个人课表预览 · {drafts.length} 条上课安排
              </h3>
              <p className="mt-2 text-xs text-[#778d7e]">
                所有字段均可修改。不同教师或不同地点分别保留，周次精确保存。
              </p>
            </div>
            <button
              className="secondary"
              onClick={() =>
                setDrafts((prev) => [
                  ...(prev || []),
                  {
                    id: crypto.randomUUID(),
                    name: "",
                    code: "",
                    teacher: "",
                    location: "",
                    day: 0,
                    startPeriod: 0,
                    endPeriod: 0,
                    weeksText: "",
                    sourceText: "手动补充",
                    notes: [],
                  },
                ])
              }
            >
              <Plus size={14} />
              补充课程
            </button>
          </div>
          <div className="space-y-4">
            {drafts.map((d, i) => {
              const problems = validateDraft(d);
              let weeks: number[] = [];
              try {
                weeks = parseWeeks(d.weeksText);
              } catch {
                /* Keep unresolved weeks visible. */
              }
              return (
                <article
                  key={d.id}
                  className={`rounded-xl border p-4 ${problems.length ? "border-[#e5bd8e] bg-[#fffcf7]" : "border-[#dce8de] bg-[#fbfdfb]"}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <strong className="text-xs">
                      安排 {i + 1}
                      {problems.length ? " · 待修正" : " · 可保存"}
                    </strong>
                    <button
                      aria-label={`删除安排${i + 1}`}
                      className="p-2 text-[#8c9c90] hover:text-red-600"
                      onClick={() =>
                        setDrafts(
                          (prev) => prev?.filter((c) => c.id !== d.id) || [],
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs">
                      课程名称 *
                      <input
                        className="field mt-1"
                        value={d.name}
                        onChange={(e) => update(d.id, { name: e.target.value })}
                      />
                    </label>
                    <label className="text-xs">
                      课程代码
                      <input
                        className="field mt-1"
                        value={d.code}
                        onChange={(e) => update(d.id, { code: e.target.value })}
                      />
                    </label>
                    <label className="text-xs">
                      教师
                      <input
                        className="field mt-1"
                        value={d.teacher}
                        onChange={(e) =>
                          update(d.id, { teacher: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs">
                      地点
                      <input
                        className="field mt-1"
                        value={d.location}
                        onChange={(e) =>
                          update(d.id, { location: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs">
                      星期 *
                      <select
                        className="field mt-1"
                        value={d.day}
                        onChange={(e) =>
                          update(d.id, { day: Number(e.target.value) })
                        }
                      >
                        <option value={0}>请选择</option>
                        {days.map((day, index) => (
                          <option key={day} value={index + 1}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      开始节次 *
                      <input
                        className="field mt-1"
                        type="number"
                        min={1}
                        max={15}
                        value={d.startPeriod || ""}
                        onChange={(e) =>
                          update(d.id, { startPeriod: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="text-xs">
                      结束节次 *
                      <input
                        className="field mt-1"
                        type="number"
                        min={1}
                        max={15}
                        value={d.endPeriod || ""}
                        onChange={(e) =>
                          update(d.id, { endPeriod: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="text-xs">
                      上课周次 *
                      <input
                        className="field mt-1"
                        value={d.weeksText}
                        placeholder="2-17周单周"
                        onChange={(e) =>
                          update(d.id, { weeksText: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-[11px] leading-6 text-[#5b876b]">
                    实际周次：
                    {weeks.length
                      ? `${weeks.join("、")}（共 ${weeks.length} 周）`
                      : "尚未确定"}
                  </p>
                  {!!problems.length && (
                    <p className="mt-2 text-xs leading-6 text-[#a7642e]">
                      {problems.join("；")}
                    </p>
                  )}
                  {!!d.notes.length && (
                    <p className="mt-2 text-[11px] text-[#7d8f81]">
                      解析提醒：{d.notes.join("；")}。可直接在上方修正。
                    </p>
                  )}
                  <details className="mt-3 text-[11px] text-[#7d8f81]">
                    <summary className="cursor-pointer">查看原始单元格</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-mono leading-6">
                      {d.sourceText || "原始文本未保留"}
                    </pre>
                  </details>
                </article>
              );
            })}
          </div>
          {!!drafts.length && !errors.length && (
            <p className="mt-4 text-xs text-[#69866f]">
              核对后将保存 {coursesFromDrafts(drafts).length}{" "}
              条安排，重复安排的周次自动合并。
            </p>
          )}
          {!drafts.length && (
            <p className="py-5 text-xs text-[#8b978e]">
              暂无课程。检查原文后重新解析，或手动补充课程。
            </p>
          )}
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {student && (
        <p className="mt-4 text-xs text-[#72877a]">
          保存后替换这位同学的现有课表；取消不会修改已有数据。
        </p>
      )}
      <div className="import-footer mt-6 flex flex-wrap justify-end gap-3 border-t border-[#e4ece6] bg-white py-4">
        {!!drafts?.length && (!name.trim() ? <button className="mr-auto self-center text-xs text-[#24775e] underline" onClick={() => nameInput.current?.focus()}>填写姓名后即可保存</button> : <p role="status" className="mr-auto self-center text-xs text-[#54745e]">{errors.length ? `还有 ${errors.length} 项需要修正` : `${drafts.length} 条安排已就绪`}</p>)}
        {!student && !text.trim() && !drafts?.length && (
          <button className="secondary" onClick={() => save(true)}>
            仅添加姓名
          </button>
        )}
        <button className="secondary" onClick={onClose}>
          取消
        </button>
        <button
          className="primary"
          disabled={
            loading || !drafts?.length || !!errors.length || !name.trim()
          }
          onClick={() => save()}
        >
          <Check size={15} />
          核对完成，保存课表
        </button>
      </div>
    </dialog>
  );
}
