"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "@/components/admin/DragHandle";

interface Row {
  key: string;
  id: string; // existing action_step id, or "" for a new row
  body: string;
}

function SortableRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row;
  onChange: (body: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3"
    >
      <DragHandle attributes={attributes} listeners={listeners} />
      <input type="hidden" name="action_step_ids[]" value={row.id} />
      <input
        type="text"
        name="action_steps[]"
        value={row.body}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Napr. Zapíš si 3 situácie…"
      />
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-xs text-muted hover:text-[#d98d8d]"
      >
        Odstrániť
      </button>
    </div>
  );
}

export function ActionStepsEditor({
  initialSteps,
}: {
  initialSteps: { id: string; body: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialSteps.map((s) => ({ key: s.id, id: s.id, body: s.body }))
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const oldIndex = items.findIndex((i) => i.key === active.id);
      const newIndex = items.findIndex((i) => i.key === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext id="action-steps" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <SortableRow
              key={row.key}
              row={row}
              onChange={(body) => updateRow(row.key, body)}
              onRemove={() => removeRow(row.key)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={addRow} className="btn btn-ghost btn-sm self-start">
        + Pridať akčný krok
      </button>
    </div>
  );
}
