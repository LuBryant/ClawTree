'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  onClick: () => void;
  size?: number;
}

export default function FloatingBall({ onClick, size = 72 }: Props) {
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [hovering, setHovering] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const elRef = useRef<HTMLDivElement>(null);

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  // Initial position: right side, ~62% down
  useEffect(() => {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    setPos({ left: w - size - 20, top: Math.round(h * 0.62) });
  }, [size]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    offsetRef.current = { x: e.clientX - pos.left, y: e.clientY - pos.top };
    startRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const left = clamp(e.clientX - offsetRef.current.x, 10, w - size - 10);
    const top = clamp(e.clientY - offsetRef.current.y, 10, h - size - 10);
    setPos({ left, top });
    if (!moved.current && Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y) > 4) {
      moved.current = true;
    }
  }, [size]);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const w = document.documentElement.clientWidth;
    setPos((prev) => ({ ...prev, left: w - size - 20 }));
    if (!moved.current) onClick();
  }, [onClick, size]);

  const peek = 16;
  const translateX = dragging.current || hovering ? 0 : size - peek;

  return (
    <div
      ref={elRef}
      className="fixed z-[9999] touch-none select-none transition-transform duration-200 cursor-pointer"
      style={{
        left: pos.left,
        top: pos.top,
        width: size,
        height: size,
        transform: `translateX(${translateX}px)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className={`flex h-full w-full items-center justify-center rounded-full text-[40px] text-white transition-shadow duration-200 ${
          hovering ? 'scale-105 shadow-lg shadow-blue-500/40' : 'shadow-xl shadow-blue-500/30'
        }`}
        style={{
          background: 'radial-gradient(circle at 40% 35%, #5b9cff 0%, #1a4fc0 100%)',
          boxShadow: hovering
            ? '0 8px 32px rgba(79,140,255,0.55), 0 0 0 5px rgba(79,140,255,0.25)'
            : '0 6px 24px rgba(79,140,255,0.40), 0 0 0 3px rgba(79,140,255,0.15)',
        }}
      >
        🤖
      </div>

      {/* Online badge */}
      <span className="absolute -top-0.5 -right-0.5 h-[18px] w-[18px] rounded-full border-2 border-zinc-950 bg-emerald-400 animate-pulse" />
    </div>
  );
}
