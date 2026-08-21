import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

export function DragHandle({
  listeners,
  attributes,
  className = "",
}: {
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  className?: string;
}) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      className={`flex shrink-0 cursor-grab touch-none items-center justify-center text-muted hover:text-gold-bright active:cursor-grabbing ${className}`}
      aria-label="Presunúť (potiahni pre zmenu poradia)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.6" />
        <circle cx="15" cy="6" r="1.6" />
        <circle cx="9" cy="12" r="1.6" />
        <circle cx="15" cy="12" r="1.6" />
        <circle cx="9" cy="18" r="1.6" />
        <circle cx="15" cy="18" r="1.6" />
      </svg>
    </button>
  );
}
