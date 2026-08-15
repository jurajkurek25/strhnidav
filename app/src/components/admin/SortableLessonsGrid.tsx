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
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "@/components/admin/DragHandle";
import { AdminLessonCard } from "@/components/admin/AdminLessonCard";
import { reorderLessons } from "@/app/admin/actions";

type LessonItem = {
  id: string;
  day_number: number;
  title: string;
  is_free: boolean;
  task_type: string;
  hls_ready: boolean;
  thumbnail_ready: boolean;
  sectionTitle: string | null;
};

function SortableCard({ lesson }: { lesson: LessonItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <AdminLessonCard
        lesson={lesson}
        dragHandle={<DragHandle attributes={attributes} listeners={listeners} />}
      />
    </div>
  );
}

export function SortableLessonsGrid({ initialLessons }: { initialLessons: LessonItem[] }) {
  const [lessons, setLessons] = useState(
    // day_number can be out of visual order right after a drag until the
    // server round-trips; keep whatever order the caller already sorted.
    initialLessons
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex((i) => i.id === active.id);
    const newIndex = lessons.findIndex((i) => i.id === over.id);
    const next = arrayMove(lessons, oldIndex, newIndex).map((item, i) => ({
      ...item,
      day_number: i + 1,
    }));
    setLessons(next);
    reorderLessons(next.map((i) => i.id));
  }

  if (lessons.length === 0) {
    return <p className="text-muted">Zatiaľ žiadne lekcie — pridaj prvú.</p>;
  }

  return (
    <DndContext id="lessons" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={lessons.map((l) => l.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.map((l) => (
            <SortableCard key={l.id} lesson={l} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
