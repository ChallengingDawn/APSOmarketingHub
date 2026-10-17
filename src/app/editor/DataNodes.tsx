"use client";

// A TABLE AND A CHART, DRAWN ON THE CANVAS (canvas list 23, 24).
//
// Kept out of EditorCanvas because it is already long enough to be dangerous
// to patch, and because these two are the only nodes made of many shapes
// rather than one: everything they draw comes from the geometry in
// src/lib/editor/dataShapes.ts, which is tested.
//
// The colours are the hub's chart palette (src/app/charts/palette.ts). Its
// series order was chosen so neighbouring colours stay apart for a
// colour-blind reader, and a fresh palette invented here would be the fourth
// blue in the building.

import { Fragment } from "react";
import type Konva from "konva";
import { Group, Rect, Line, Arc, Text as KText } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";

import type { DesignNode } from "@/lib/design-document";
import {
  barLayout,
  columnLayout,
  donutSlices,
  formatValue,
  lineLayout,
  tableLayout,
} from "@/lib/editor/dataShapes";
import { CHROME, SERIES } from "@/app/charts/palette";

export type DataNodeProps = {
  node: DesignNode;
  fontFamily: string;
  onSelect: (e: KonvaEventObject<MouseEvent>) => void;
  onTap: () => void;
  onDragMove: (e: KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
  onCursor: (e: KonvaEventObject<MouseEvent>, cursor: string) => void;
  /** Width, height, x, y and rotation after a transform, scale already undone. */
  onResize: (box: { x: number; y: number; width: number; height: number; rotation: number }) => void;
};

/** A transform on a group has to be converted back into a size, once. */
function resizeHandler(node: DesignNode, onResize: DataNodeProps["onResize"]) {
  return (e: KonvaEventObject<Event>) => {
    const t = e.target as Konva.Group;
    const sx = Math.abs(t.scaleX());
    const sy = Math.abs(t.scaleY());
    onResize({
      x: t.x(),
      y: t.y(),
      // A table scaled to nothing is unrecoverable, so there is a floor.
      width: Math.max(80, (node.width ?? 300) * sx),
      height: Math.max(40, (node.height ?? 160) * sy),
      rotation: t.rotation(),
    });
    // The group keeps its own size; the scale was only the gesture.
    t.scaleX(1);
    t.scaleY(1);
  };
}

const PAD = 10;

export function TableNode(p: DataNodeProps) {
  const { node: n } = p;
  const w = n.width ?? 360;
  const h = n.height ?? 160;
  const rows = n.rows ?? [];
  const { cells, lines, rowH } = tableLayout(rows, w, h, n.colFractions);
  const fontSize = n.fontSize ?? Math.max(10, Math.min(16, rowH * 0.42));
  const ink = n.fill || CHROME.ink;
  const rule = n.stroke || CHROME.grid;
  const radius = n.cornerRadius ?? 10;

  return (
    <Group
      id={n.id}
      x={n.x}
      y={n.y}
      rotation={n.rotation ?? 0}
      opacity={n.opacity ?? 1}
      draggable={!n.locked}
      onClick={p.onSelect}
      onTap={p.onTap}
      onMouseEnter={(e) => p.onCursor(e, n.locked ? "default" : "move")}
      onMouseLeave={(e) => p.onCursor(e, "default")}
      onDragMove={p.onDragMove}
      onDragEnd={p.onDragEnd}
      onTransformEnd={resizeHandler(n, p.onResize)}
    >
      {/* The surface. A table on a photograph is unreadable without one, and
          a transparent table is not a thing anybody asks for. */}
      <Rect width={w} height={h} fill={n.backgroundFill || "#ffffff"} cornerRadius={radius} />
      {rows.length > 0 && (
        // The header band, square at the bottom so it meets the first rule.
        <Rect width={w} height={rowH} fill={CHROME.grid} cornerRadius={[radius, radius, 0, 0]} />
      )}
      {lines.map((l, i) => (
        <Line key={i} points={[l.x1, l.y1, l.x2, l.y2]} stroke={rule} strokeWidth={1} listening={false} />
      ))}
      {cells.map((c) => (
        <KText
          key={`${c.row}-${c.col}`}
          x={c.x + PAD}
          // Optically centred in the row: Konva measures from the top of the
          // line box, so the glyphs sit low unless the leading is taken off.
          y={c.y + (c.h - fontSize * 1.15) / 2}
          width={Math.max(1, c.w - PAD * 2)}
          height={c.h}
          text={c.text}
          fontSize={fontSize}
          fontFamily={p.fontFamily}
          fontStyle={c.header ? "600" : "normal"}
          fill={ink}
          // A cell that is too narrow ends in an ellipsis rather than
          // spilling over its neighbour, which reads as a broken table.
          wrap="none"
          ellipsis
          listening={false}
        />
      ))}
      {/* The border last, so it sits over the rules it has to meet. */}
      <Rect
        width={w}
        height={h}
        stroke={rule}
        strokeWidth={1}
        cornerRadius={radius}
        listening={false}
      />
    </Group>
  );
}

export function ChartNode(p: DataNodeProps) {
  const { node: n } = p;
  const w = n.width ?? 320;
  const h = n.height ?? 200;
  const data = n.series ?? [];
  const kind = n.chartKind ?? "column";
  const ink = n.fill || CHROME.ink;
  const mark = n.accent || SERIES[0];
  const label = CHROME.label;
  const fontSize = n.fontSize ?? 11;
  const showValues = n.showValues !== false;
  // One colour per category only when the categories ARE the subject - a ring
  // of shares. A single measure across years is one hue, because the colour
  // would otherwise be saying something the data does not.
  const colourOf = (i: number) =>
    n.multicolour || kind === "donut" ? SERIES[i % SERIES.length] : mark;

  const frame = (
    <Group
      id={n.id}
      x={n.x}
      y={n.y}
      rotation={n.rotation ?? 0}
      opacity={n.opacity ?? 1}
      draggable={!n.locked}
      onClick={p.onSelect}
      onTap={p.onTap}
      onMouseEnter={(e) => p.onCursor(e, n.locked ? "default" : "move")}
      onMouseLeave={(e) => p.onCursor(e, "default")}
      onDragMove={p.onDragMove}
      onDragEnd={p.onDragEnd}
      onTransformEnd={resizeHandler(n, p.onResize)}
    >
      {/* The surface. Transparent unless somebody has chosen one, but always
          PRESENT, so the whole box is a hit target - a chart you can only
          grab by one of its bars is a chart you cannot move. (This line used
          to be a ternary returning "transparent" in both branches, which is
          what made the surface colour unreachable.) */}
      <Rect
        width={w}
        height={h}
        fill={n.backgroundFill || "transparent"}
        cornerRadius={n.cornerRadius ?? 0}
      />

      {kind === "column" && (() => {
        const l = columnLayout(data, w, h, { valueRoom: showValues ? fontSize + 7 : 4 });
        return (
          <Fragment>
            <Line points={[0, l.baseline, w, l.baseline]} stroke={CHROME.axis} strokeWidth={1} listening={false} />
            {l.columns.map((c, i) => (
              <Fragment key={c.label + i}>
                <Rect
                  x={c.x}
                  y={c.y}
                  width={c.w}
                  height={c.h}
                  fill={colourOf(i)}
                  // Rounded at the top, square on the baseline: a bar rounded
                  // at the bottom floats, and a floating bar misreads its
                  // own value.
                  cornerRadius={[4, 4, 0, 0]}
                  listening={false}
                />
                {showValues && (
                  <KText
                    x={c.x}
                    y={c.y - fontSize - 4}
                    width={c.w}
                    text={formatValue(c.value)}
                    fontSize={fontSize}
                    fontFamily={p.fontFamily}
                    fontStyle="600"
                    fill={ink}
                    align="center"
                    listening={false}
                  />
                )}
                <KText
                  x={c.x - 2}
                  y={l.labelY}
                  width={c.w + 4}
                  text={c.label}
                  fontSize={fontSize}
                  fontFamily={p.fontFamily}
                  fill={label}
                  align="center"
                  wrap="none"
                  ellipsis
                  listening={false}
                />
              </Fragment>
            ))}
          </Fragment>
        );
      })()}

      {kind === "bar" && (() => {
        const l = barLayout(data, w, h);
        return (
          <Fragment>
            {l.bars.map((b, i) => (
              <Fragment key={b.label + i}>
                <KText
                  x={0}
                  y={b.y + (b.h - fontSize * 1.15) / 2}
                  width={Math.max(1, l.labelW - 8)}
                  text={b.label}
                  fontSize={fontSize}
                  fontFamily={p.fontFamily}
                  fill={label}
                  align="right"
                  wrap="none"
                  ellipsis
                  listening={false}
                />
                <Rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  fill={colourOf(i)}
                  cornerRadius={[0, 4, 4, 0]}
                  listening={false}
                />
                {showValues && (
                  <KText
                    x={b.x + b.w + 6}
                    y={b.y + (b.h - fontSize * 1.15) / 2}
                    text={formatValue(b.value)}
                    fontSize={fontSize}
                    fontFamily={p.fontFamily}
                    fontStyle="600"
                    fill={ink}
                    listening={false}
                  />
                )}
              </Fragment>
            ))}
          </Fragment>
        );
      })()}

      {kind === "line" && (() => {
        const l = lineLayout(data, w, h, { valueRoom: showValues ? fontSize + 7 : 6 });
        return (
          <Fragment>
            <Line points={[0, l.baseline, w, l.baseline]} stroke={CHROME.axis} strokeWidth={1} listening={false} />
            {l.dots.length > 1 && (
              <Line
                points={l.points}
                stroke={mark}
                strokeWidth={2}
                // Rounded joins, because a 2px line with mitred corners
                // grows a spike at every turn.
                lineJoin="round"
                lineCap="round"
                listening={false}
              />
            )}
            {l.dots.map((d, i) => (
              <Fragment key={d.label + i}>
                {/* A ring of surface around each marker, so two points close
                    together stay two points. */}
                <Arc
                  x={d.x}
                  y={d.y}
                  innerRadius={0}
                  outerRadius={4.5}
                  angle={360}
                  fill={mark}
                  stroke="#ffffff"
                  strokeWidth={2}
                  listening={false}
                />
                <KText
                  x={d.x - 24}
                  y={l.baseline + 4}
                  width={48}
                  text={d.label}
                  fontSize={fontSize}
                  fontFamily={p.fontFamily}
                  fill={label}
                  align="center"
                  wrap="none"
                  ellipsis
                  listening={false}
                />
                {showValues && (
                  <KText
                    x={d.x - 24}
                    y={d.y - fontSize - 8}
                    width={48}
                    text={formatValue(d.value)}
                    fontSize={fontSize}
                    fontFamily={p.fontFamily}
                    fontStyle="600"
                    fill={ink}
                    align="center"
                    listening={false}
                  />
                )}
              </Fragment>
            ))}
          </Fragment>
        );
      })()}

      {kind === "donut" && (() => {
        const { slices } = donutSlices(data);
        const r = Math.max(10, Math.min(w, h) / 2);
        const cx = r;
        const cy = h / 2;
        return (
          <Fragment>
            {slices.map((s, i) => (
              <Arc
                key={s.label + i}
                x={cx}
                y={cy}
                innerRadius={r * 0.62}
                outerRadius={r}
                angle={s.angle}
                rotation={s.rotation}
                fill={colourOf(i)}
                // A 2px gap of surface between neighbours, so two similar
                // colours do not read as one slice.
                stroke="#ffffff"
                strokeWidth={2}
                listening={false}
              />
            ))}
            {/* A ring needs its key beside it: a slice cannot carry its own
                name the way a bar can. */}
            {slices.map((s, i) => (
              <Fragment key={`k${s.label}${i}`}>
                <Rect
                  x={r * 2 + 14}
                  y={cy - (slices.length * (fontSize + 8)) / 2 + i * (fontSize + 8) + 3}
                  width={9}
                  height={9}
                  cornerRadius={2}
                  fill={colourOf(i)}
                  listening={false}
                />
                <KText
                  x={r * 2 + 29}
                  y={cy - (slices.length * (fontSize + 8)) / 2 + i * (fontSize + 8)}
                  width={Math.max(1, w - r * 2 - 32)}
                  text={showValues ? `${s.label} · ${Math.round(s.share * 100)}%` : s.label}
                  fontSize={fontSize}
                  fontFamily={p.fontFamily}
                  fill={label}
                  wrap="none"
                  ellipsis
                  listening={false}
                />
              </Fragment>
            ))}
          </Fragment>
        );
      })()}
    </Group>
  );

  return frame;
}
