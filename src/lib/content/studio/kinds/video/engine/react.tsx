// THE FILM ENGINE'S REACT HALF (08.11.2026) - the team's own small frame engine (black-friday-2026/video
// src/engine/index.tsx), ported: no third-party video framework (Remotion was dropped for its licence). A film is a
// React tree drawn as a pure function of the frame; the studio's player moves the frame on its own clock, the render
// machine moves it frame by frame and screenshots each one.
import React, { createContext, useContext } from "react";

// frame: the local frame of the nearest Sequence; start: the absolute frame where that local 0 sits;
// [lo, hi): the absolute window in which every ancestor Sequence shows.
export type Timeline = { frame: number; start: number; lo: number; hi: number };
const TimelineCtx = createContext<Timeline>({ frame: 0, start: 0, lo: 0, hi: Infinity });
export const TimelineProvider = TimelineCtx.Provider;

export const useCurrentFrame = () => useContext(TimelineCtx).frame;
export const useTimeline = () => useContext(TimelineCtx);

const FILL: React.CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" };

export const AbsoluteFill: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ style, ...rest }) => <div {...rest} style={{ ...FILL, ...style }} />;

/** Shows its children from `from` for `durationInFrames`; inside, frames count from 0. */
export const Sequence: React.FC<{ from?: number; durationInFrames?: number; layout?: "absolute-fill" | "none"; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  from = 0, durationInFrames = Infinity, layout = "absolute-fill", style, children,
}) => {
  const parent = useContext(TimelineCtx);
  const frame = parent.frame - from;
  if (frame < 0 || frame >= durationInFrames) return null;
  const start = parent.start + from;
  const t = { frame, start, lo: Math.max(parent.lo, start), hi: Math.min(parent.hi, start + durationInFrames) };
  return <TimelineProvider value={t}>{layout === "none" ? children : <AbsoluteFill style={style}>{children}</AbsoluteFill>}</TimelineProvider>;
};

/** A plain <img>; the render machine waits until every image is decoded before each screenshot. */
// eslint-disable-next-line @next/next/no-img-element
export const Img: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => <img decoding="sync" draggable={false} {...props} />;
