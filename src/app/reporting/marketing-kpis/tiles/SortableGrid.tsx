"use client";
// TILES YOU CAN MOVE (SARCLA 19.10.2026: "press continuously with the mouse on a graph and you can
// move it inside the card"). Hold the mouse on a tile for a moment - or a finger, a little longer -
// and drag it to its place in the panel; the others make room. A quick click, a text selection or a
// scroll still work as before: the drag only starts after the hold. One order for everyone, kept by
// the hub (tiles/store, kpiActions "order"); tiles it does not know yet come after, as they were.

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type SortItem = { key: string; node: React.ReactNode; sx?: object };

/** The items in the saved order; the ones it does not name keep their own order, after. */
export function inOrder<T extends { key: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items;
  const at = new Map(order.map((k, i) => [k, i]));
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (at.get(a.it.key) ?? order.length + a.i) - (at.get(b.it.key) ?? order.length + b.i))
    .map((x) => x.it);
}

function Sortable({ item, canMove }: { item: SortItem; canMove: boolean }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key, disabled: !canMove });
  return (
    <Box ref={setNodeRef} {...(canMove ? listeners : {})}
      sx={{
        minWidth: 0, position: "relative", ...item.sx,
        transform: CSS.Translate.toString(transform), transition,
        ...(isDragging ? { zIndex: 5, cursor: "grabbing", "& > *": { boxShadow: "0 18px 40px rgba(31,45,78,.22)", outline: "2px solid rgba(45,111,168,.35)" } } : {}),
      }}>
      {item.node}
    </Box>
  );
}

export function SortableGrid({ items, order, canMove, onMove, sx }: {
  items: SortItem[];
  /** the saved order, first to last */
  order: string[] | undefined;
  canMove: boolean;
  /** the new order of every key, after a tile was dropped */
  onMove: (keys: string[]) => void;
  sx?: object;
}) {
  // the drop shows at once; the saved order takes over when it comes back
  const [local, setLocal] = useState<string[] | null>(null);
  const savedKey = (order ?? []).join("|");
  useEffect(() => { setLocal(null); }, [savedKey]);
  const shown = useMemo(() => inOrder(items, local ?? order), [items, local, order]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
  );
  const end = (e: DragEndEvent) => {
    const from = shown.findIndex((x) => x.key === e.active.id), to = e.over ? shown.findIndex((x) => x.key === e.over!.id) : -1;
    if (from < 0 || to < 0 || from === to) return;
    const keys = arrayMove(shown.map((x) => x.key), from, to);
    setLocal(keys);
    onMove(keys);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
      <SortableContext items={shown.map((x) => x.key)} strategy={rectSortingStrategy}>
        <Box sx={sx}>{shown.map((it) => <Sortable key={it.key} item={it} canMove={canMove} />)}</Box>
      </SortableContext>
    </DndContext>
  );
}
