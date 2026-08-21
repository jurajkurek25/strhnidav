"use client";

import { useState } from "react";

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  is_own: boolean;
}

export function CommentsSection({
  lessonId,
  initialComments,
}: {
  lessonId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, body }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((c) => [...c, data.comment]);
        setBody("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setComments((c) => c.filter((x) => x.id !== id));
    await fetch(`/api/comments/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={post} className="flex flex-col gap-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Napíš komentár alebo otázku k tejto lekcii…"
          rows={3}
        />
        <button type="submit" className="btn btn-sm self-start" disabled={loading}>
          {loading ? "Odosielam…" : "Pridať komentár"}
        </button>
      </form>

      <ul className="flex flex-col gap-6">
        {comments.length === 0 && (
          <li className="text-sm text-muted">Zatiaľ žiadne komentáre — buď prvý.</li>
        )}
        {comments.map((c) => (
          <li key={c.id} className="flex gap-4">
            {c.author_avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.author_avatar} alt="" width={32} height={32} className="rounded-full border border-card-line" />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded-full border border-card-line bg-card" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-cream">{c.author_name ?? "Člen"}</span>
                <span className="text-xs text-muted">
                  {new Date(c.created_at).toLocaleDateString("sk-SK")}
                </span>
                {c.is_own && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto text-xs text-muted underline hover:text-[#d98d8d]"
                  >
                    Zmazať
                  </button>
                )}
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
