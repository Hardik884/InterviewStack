type ProgressBarProps = {
  value: number;
};

const ProgressBar = ({ value }: ProgressBarProps) => {
  const step = Math.max(0, Math.min(100, Math.round(value / 10) * 10));
  const widthClasses: Record<number, string> = {
    0: "w-0",
    10: "w-1/12",
    20: "w-2/12",
    30: "w-3/12",
    40: "w-4/12",
    50: "w-6/12",
    60: "w-7/12",
    70: "w-9/12",
    80: "w-10/12",
    90: "w-11/12",
    100: "w-full",
  };

  return (
    <div className="h-2 w-full rounded-full bg-ink/10">
      <div
        className={`h-2 rounded-full bg-accent transition-all ${widthClasses[step]}`}
      />
    </div>
  );
};

export default ProgressBar;
