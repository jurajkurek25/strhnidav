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
import { deleteSection, reorderSections } from "@/app/admin/actions";

interface SectionItem {
  id: string;
  title: string;
  description: string | null;
  lessonCount: number;
}

function Row({ section }: { section: SectionItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="card flex items-center gap-3 p-4"
    >
      <DragHandle attributes={attributes} listeners={listeners} />
      <div className="flex-1">
        <p className="font-medium text-cream">{section.title}</p>
        {section.description && <p className="mt-1 text-sm text-muted">{section.description}</p>}
        <p className="mt-1 text-xs text-muted">{section.lessonCount} lekcií</p>
      </div>
      <form action={deleteSection.bind(null, section.id)}>
        <button type="submit" className="btn btn-danger btn-sm">
          Zmazať
        </button>
      </form>
    </li>
  );
}

export function SortableSections({ initialSections }: { initialSections: SectionItem[] }) {
  const [sections, setSections] = useState(initialSections);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((i) => i.id === active.id);
    const newIndex = sections.findIndex((i) => i.id === over.id);
    const next = arrayMove(sections, oldIndex, newIndex);
    setSections(next);
    reorderSections(next.map((i) => i.id));
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted">Zatiaľ žiadne sekcie.</p>;
  }

  return (
    <DndContext id="sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2.5">
          {sections.map((s) => (
            <Row key={s.id} section={s} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
