import { saveLesson, deleteDocument, deleteAudio } from "@/app/admin/actions";
import { ActionStepsEditor } from "@/components/admin/ActionStepsEditor";
import type { Database } from "@/types/database";

type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
type Section = Database["public"]["Tables"]["sections"]["Row"];
type Doc = Database["public"]["Tables"]["lesson_documents"]["Row"];
type Audio = Database["public"]["Tables"]["lesson_audio"]["Row"];

export function LessonForm({
  lesson,
  sections,
  actionSteps,
  documents,
  audio,
  nextDayNumber,
}: {
  lesson: Lesson | null;
  sections: Section[];
  actionSteps: { id: string; body: string }[];
  documents: Doc[];
  audio: Audio[];
  nextDayNumber: number;
}) {
  return (
    <form action={saveLesson} className="flex flex-col gap-8">
      {lesson && <input type="hidden" name="lesson_id" value={lesson.id} />}

      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Deň
          <input
            type="number"
            name="day_number"
            min={1}
            defaultValue={lesson?.day_number ?? nextDayNumber}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Sekcia
          <select name="section_id" defaultValue={lesson?.section_id ?? ""}>
            <option value="">Bez sekcie</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-muted sm:col-span-2">
          Názov lekcie
          <input type="text" name="title" defaultValue={lesson?.title ?? ""} required />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-muted sm:col-span-2">
          Popis (zobrazí sa nad videom)
          <textarea name="description" rows={2} defaultValue={lesson?.description ?? ""} />
        </label>

        <label className="flex items-center gap-2 text-sm text-cream">
          <input
            type="checkbox"
            name="is_free"
            defaultChecked={lesson?.is_free ?? false}
            className="h-4 w-4"
          />
          Táto lekcia je súčasťou 7 bezplatných lekcií
        </label>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-medium">Video</h2>
        {lesson?.hls_ready ? (
          <p className="text-xs text-muted">
            Video je nahrané a zašifrované ({lesson.hls_segment_count ?? "?"} segmentov). Nahraj
            nový súbor pre nahradenie.
          </p>
        ) : (
          <p className="text-xs text-muted">Zatiaľ žiadne video.</p>
        )}
        <input type="file" name="video" accept="video/*" />
        <p className="text-xs text-muted">
          Po odoslaní formulára appka video rozseká a zašifruje (AES-128 HLS) — pri dlhších
          videách to môže chvíľu trvať, stránka počká na dokončenie.
        </p>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-medium">Úloha dňa</h2>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Typ úlohy
          <select name="task_type" defaultValue={lesson?.task_type ?? "text"}>
            <option value="text">Text — AI vyhodnotí napísanú odpoveď</option>
            <option value="image">Fotka/screenshot — AI vyhodnotí obrázok</option>
            <option value="pdf">Dokument (PDF) — AI vyhodnotí súbor</option>
            <option value="self_check">Bez AI — člen si len odškrtne splnenie</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Zadanie úlohy (inštrukcie pre člena aj pre AI)
          <textarea name="task_prompt" rows={3} defaultValue={lesson?.task_prompt ?? ""} />
        </label>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-medium">Akčné kroky (checklist)</h2>
        <ActionStepsEditor initialSteps={actionSteps} />
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-medium">Dokumenty na stiahnutie</h2>
        {documents.length > 0 && (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-cream">{d.title}</span>
                {lesson && (
                  <form action={deleteDocument.bind(null, d.id, lesson.id)}>
                    <button type="submit" className="text-xs text-muted hover:text-[#d98d8d]">
                      Odstrániť
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <input type="file" name="new_documents" multiple />
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-medium">Audio na stiahnutie</h2>
        {audio.length > 0 && (
          <ul className="flex flex-col gap-2">
            {audio.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-cream">{a.title}</span>
                {lesson && (
                  <form action={deleteAudio.bind(null, a.id, lesson.id)}>
                    <button type="submit" className="text-xs text-muted hover:text-[#d98d8d]">
                      Odstrániť
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <input type="file" name="new_audio" multiple accept="audio/*" />
      </div>

      <button type="submit" className="btn self-start">
        {lesson ? "Uložiť zmeny" : "Vytvoriť lekciu"}
      </button>
    </form>
  );
}
