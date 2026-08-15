"use client";

import { useState } from "react";
import type { TaskType } from "@/types/database";

interface LatestSubmission {
  status: "pending" | "approved" | "rejected";
  ai_feedback: string | null;
}

export function TaskSubmissionForm({
  lessonId,
  taskType,
  taskPrompt,
  initialSubmission,
  onApproved,
}: {
  lessonId: string;
  taskType: TaskType;
  taskPrompt: string | null;
  initialSubmission: LatestSubmission | null;
  onApproved: () => void;
}) {
  const [submission, setSubmission] = useState(initialSubmission);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApproved = submission?.status === "approved";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const form = new FormData();
      form.set("lessonId", lessonId);
      form.set("submissionType", taskType);
      if (taskType === "text") form.set("text", text);
      if ((taskType === "image" || taskType === "pdf") && file) form.set("file", file);

      const res = await fetch("/api/tasks/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Odoslanie zlyhalo.");

      setSubmission({ status: data.status, ai_feedback: data.ai_feedback ?? null });
      if (data.status === "approved") onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Niečo sa pokazilo.");
    } finally {
      setLoading(false);
    }
  }

  if (isApproved) {
    return (
      <div className="card p-5">
        <p className="text-sm text-good">Úloha splnená ✓</p>
        {submission?.ai_feedback && (
          <p className="mt-2 text-sm text-muted">{submission.ai_feedback}</p>
        )}
      </div>
    );
  }

  if (taskType === "self_check") {
    return (
      <form onSubmit={submit} className="card p-5">
        {taskPrompt && <p className="mb-3 text-sm text-muted">{taskPrompt}</p>}
        <button type="submit" className="btn btn-sm" disabled={loading}>
          {loading ? "Ukladám…" : "Označujem, že som úlohu splnil"}
        </button>
        {error && <p className="mt-2 text-xs text-[#d98d8d]">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
      {taskPrompt && <p className="text-sm text-muted">{taskPrompt}</p>}

      {submission?.status === "rejected" && (
        <div className="rounded-sm border border-wine/50 bg-wine/10 p-3 text-sm text-[#d98d8d]">
          <p className="font-semibold">AI vyhodnotila úlohu ako nesplnenú:</p>
          <p className="mt-1">{submission.ai_feedback}</p>
          <p className="mt-1 text-muted">Skús to prosím znova nižšie.</p>
        </div>
      )}
      {submission?.status === "pending" && (
        <p className="text-xs text-muted">Vyhodnocujem tvoju predchádzajúcu odpoveď…</p>
      )}

      {taskType === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Napíš, ako si úlohu splnil…"
          rows={4}
          required
        />
      )}

      {(taskType === "image" || taskType === "pdf") && (
        <input
          type="file"
          accept={taskType === "image" ? "image/*" : "application/pdf"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className="text-sm text-muted file:mr-3 file:rounded-sm file:border-0 file:bg-gold file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg"
        />
      )}

      <button type="submit" className="btn btn-sm self-start" disabled={loading}>
        {loading ? "Odosielam…" : "Odoslať na vyhodnotenie"}
      </button>
      {error && <p className="text-xs text-[#d98d8d]">{error}</p>}
    </form>
  );
}
