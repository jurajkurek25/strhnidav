"use client";

import { useState } from "react";

interface Row {
  key: string;
  id: string; // existing action_step id, or "" for a new row
  body: string;
}

export function ActionStepsEditor({
  initialSteps,
}: {
  initialSteps: { id: string; body: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialSteps.map((s) => ({ key: s.id, id: s.id, body: s.body }))
  );

  function addRow() {
    setRows((r) => [...r, { key: crypto.randomUUID(), id: "", body: "" }]);
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((row) => row.key !== key));
  }

  function updateRow(key: string, body: string) {
    setRows((r) => r.map((row) => (row.key === key ? { ...row, body } : row)));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <input type="hidden" name="action_step_ids[]" value={row.id} />
          <input
            type="text"
            name="action_steps[]"
            value={row.body}
            onChange={(e) => updateRow(row.key, e.target.value)}
            placeholder="Napr. Zapíš si 3 situácie…"
          />
          <button
            type="button"
            onClick={() => removeRow(row.key)}
            className="shrink-0 text-xs text-muted hover:text-[#d98d8d]"
          >
            Odstrániť
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="btn btn-ghost btn-sm self-start">
        + Pridať akčný krok
      </button>
    </div>
  );
}
