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

interface FileItem {
  id: string;
  title: string;
}

function Row({ item, onDelete }: { item: FileItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex items-center gap-3 text-sm"
    >
      <DragHandle attributes={attributes} listeners={listeners} />
      <span className="flex-1 text-cream">{item.title}</span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="text-xs text-muted hover:text-[#d98d8d]"
      >
        Odstrániť
      </button>
    </li>
  );
}

export function SortableFileList({
  dndId,
  initialItems,
  onReorder,
  onDelete,
}: {
  /** Must be unique per instance — dnd-kit needs it to keep generated aria ids SSR-stable when more than one DndContext is on the same page. */
  dndId: string;
  initialItems: FileItem[];
  onReorder: (orderedIds: string[]) => void;
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState(initialItems);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    onReorder(next.map((i) => i.id));
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    onDelete(id);
  }

  if (items.length === 0) return null;

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <Row key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
