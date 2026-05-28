import { cn } from "../../utils/cn";

type SkeletonProps = {
  className?: string;
};

const Skeleton = ({ className }: SkeletonProps) => {
  return (
    <div
      className={cn(
        "h-4 w-full animate-pulse rounded-full bg-ink/10",
        className
      )}
    />
  );
};

export default Skeleton;
