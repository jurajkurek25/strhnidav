"use client";

import { useEffect, useState } from "react";
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
import { deleteSection, reorderSections, updateSectionMeta } from "@/app/admin/actions";

interface SectionItem {
  id: string;
  title: string;
  description: string | null;
  priceCents: number;
  slug: string | null;
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
      className="card flex flex-col gap-5 p-6"
    >
      <div className="flex items-center gap-4">
        <DragHandle attributes={attributes} listeners={listeners} />
        <p className="min-w-0 flex-1 text-xs text-muted">{section.lessonCount} lekcií</p>
        <form action={deleteSection.bind(null, section.id)}>
          <button type="submit" className="btn btn-danger btn-sm">
            Zmazať
          </button>
        </form>
      </div>

      <form
        action={updateSectionMeta.bind(null, section.id)}
        className="flex flex-col gap-3 border-t border-card-line pt-5"
      >
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Názov bloku
          <input
            type="text"
            name="title"
            required
            defaultValue={section.title}
            className="!py-2.5 !px-3 !text-sm font-medium"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Popis
          <textarea
            name="description"
            defaultValue={section.description ?? ""}
            rows={2}
            className="!py-2.5 !px-3 !text-sm"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Cena bloku (€)
            <input
              type="number"
              name="price_eur"
              step="0.01"
              min="0"
              defaultValue={(section.priceCents / 100).toFixed(2)}
              className="!w-28 !py-2.5 !px-3 !text-sm"
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5 text-xs text-muted">
            Priamy odkaz (/buy/…)
            <input
              type="text"
              name="slug"
              defaultValue={section.slug ?? ""}
              placeholder="napr. randenie-pre-muzov"
              className="!py-2.5 !px-3 !text-sm"
            />
          </label>
          <button type="submit" className="btn btn-ghost btn-sm">
            Uložiť
          </button>
        </div>
      </form>

      {section.slug && (
        <p className="text-xs text-muted">
          Priamy odkaz: <code className="text-gold-bright">kurz.strhnidav.sk/buy/{section.slug}</code>
        </p>
      )}
    </li>
  );
}

export function SortableSections({ initialSections }: { initialSections: SectionItem[] }) {
  const [sections, setSections] = useState(initialSections);
  // initialSections is a fresh array every time the server component behind
  // this page re-renders (after createSection/deleteSection revalidate it),
  // but useState's initializer only runs on mount — without this effect,
  // adds/deletes never reach the already-mounted local copy below.
  useEffect(() => setSections(initialSections), [initialSections]);
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
        <ul className="flex flex-col gap-3.5">
          {sections.map((s) => (
            <Row key={s.id} section={s} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
