import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const snap = (v: number, steps: number[]) =>
  steps.reduce((prev, curr) => (Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev));

type WorkspaceLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  bottomOpen: boolean;
  onToggleBottom: () => void;
};

const colSteps = [25, 30, 35, 40, 45, 50, 55, 60];

const WorkspaceLayout = ({
  left,
  center,
  right,
  bottom,
  bottomOpen,
  onToggleBottom,
}: WorkspaceLayoutProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(30);
  const [centerWidth, setCenterWidth] = useState(50);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;

      if (dragging === "left") {
        const nextLeft = snap(clamp(pct, 20, 45), colSteps);
        const nextCenter = snap(clamp(100 - nextLeft - 20, 30, 60), colSteps);
        setLeftWidth(nextLeft);
        setCenterWidth(nextCenter);
      } else {
        const nextCenter = snap(clamp(pct - leftWidth, 30, 60), colSteps);
        setCenterWidth(nextCenter);
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, leftWidth]);

  const rightWidth = 100 - leftWidth - centerWidth;

  return (
    <div className="flex flex-col gap-3">
      {/* Main 3-column grid */}
      <div
        ref={containerRef}
        className={`flex h-[72vh] min-h-[520px] w-full overflow-hidden rounded-3xl border border-ink/8 bg-white/80 shadow-soft ${dragging ? "select-none" : ""}`}
      >
        {/* Left panel */}
        <div
          className="flex h-full min-h-0 flex-col border-r border-ink/8 overflow-hidden"
          style={{ width: `${leftWidth}%` }}
        >
          {left}
        </div>

        {/* Divider L */}
        <div
          className="flex-none w-1.5 cursor-col-resize bg-ink/4 hover:bg-ink/10 transition-colors active:bg-accent/20"
          onMouseDown={() => setDragging("left")}
          role="separator"
          aria-label="Resize left panel"
        />

        {/* Center panel */}
        <div
          className="flex h-full min-h-0 flex-col overflow-hidden"
          style={{ width: `${centerWidth}%` }}
        >
          {center}
        </div>

        {/* Divider R */}
        <div
          className="flex-none w-1.5 cursor-col-resize bg-ink/4 hover:bg-ink/10 transition-colors active:bg-accent/20"
          onMouseDown={() => setDragging("right")}
          role="separator"
          aria-label="Resize right panel"
        />

        {/* Right panel */}
        <div
          className="flex h-full min-h-0 flex-col border-l border-ink/8 overflow-hidden"
          style={{ width: `${rightWidth}%` }}
        >
          {right}
        </div>
      </div>

      {/* Bottom panel (collapsible) */}
      <div className="overflow-hidden rounded-3xl border border-ink/8 bg-white/95 shadow-soft">
        <button
          type="button"
          onClick={onToggleBottom}
          aria-expanded={bottomOpen}
          aria-controls="workspace-bottom-panel"
          className="flex w-full items-center justify-between border-b border-ink/6 px-5 py-3 text-sm font-semibold hover:bg-ink/2 transition-colors"
        >
          <span className="text-ink">Output &amp; test cases</span>
          <motion.span
            animate={{ rotate: bottomOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-ink/40"
          >
            ▾
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {bottomOpen && (
            <motion.div
              id="workspace-bottom-panel"
              key="bottom"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="p-5">{bottom}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
