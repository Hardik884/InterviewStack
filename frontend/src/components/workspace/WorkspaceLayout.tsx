import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const pickNearest = (value: number, steps: number[]) => {
  return steps.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
};

type WorkspaceLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
  bottomOpen: boolean;
  onToggleBottom: () => void;
};

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
    const handleMove = (event: MouseEvent) => {
      if (!containerRef.current || !dragging) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const percent = (offsetX / rect.width) * 100;

      if (dragging === "left") {
        const nextLeft = pickNearest(clamp(percent, 25, 45), [25, 30, 35, 40, 45]);
        const nextCenter = pickNearest(
          clamp(100 - nextLeft - 20, 35, 60),
          [35, 40, 45, 50, 55, 60]
        );
        setLeftWidth(nextLeft);
        setCenterWidth(nextCenter);
      }

      if (dragging === "right") {
        const leftPlusCenter = clamp(percent, 55, 80);
        const nextCenter = pickNearest(leftPlusCenter - leftWidth, [35, 40, 45, 50, 55, 60]);
        setCenterWidth(nextCenter);
      }
    };

    const handleUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, leftWidth]);

  const rightWidth = 100 - leftWidth - centerWidth;
  const widthClasses: Record<number, string> = {
    25: "w-[25%]",
    30: "w-[30%]",
    35: "w-[35%]",
    40: "w-[40%]",
    45: "w-[45%]",
    50: "w-[50%]",
    55: "w-[55%]",
    60: "w-[60%]",
    15: "w-[15%]",
    20: "w-[20%]",
  };
  const rightClass = widthClasses[rightWidth] || "w-[20%]";

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="flex h-[70vh] min-h-[560px] w-full overflow-hidden rounded-3xl border border-ink/10 bg-white/70"
      >
        <div
          className={`flex h-full min-h-0 flex-col border-r border-ink/10 ${
            widthClasses[leftWidth] || "w-[30%]"
          }`}
        >
          {left}
        </div>
        <div
          className="w-2 cursor-col-resize bg-ink/5 hover:bg-ink/10"
          onMouseDown={() => setDragging("left")}
        />
        <div
          className={`flex h-full min-h-0 flex-col ${
            widthClasses[centerWidth] || "w-[50%]"
          }`}
        >
          {center}
        </div>
        <div
          className="w-2 cursor-col-resize bg-ink/5 hover:bg-ink/10"
          onMouseDown={() => setDragging("right")}
        />
        <div
          className={`flex h-full min-h-0 flex-col border-l border-ink/10 ${rightClass}`}
        >
          {right}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white/90">
        <button
          type="button"
          onClick={onToggleBottom}
          className="flex w-full items-center justify-between border-b border-ink/10 px-5 py-3 text-sm font-semibold"
        >
          <span>Output & testcases</span>
          <span className="text-xs text-ink/60">
            {bottomOpen ? "Collapse" : "Expand"}
          </span>
        </button>
        <div className={`${bottomOpen ? "block" : "hidden"} p-5`}>{bottom}</div>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
