import Skeleton from "./ui/Skeleton";

const ProblemRowSkeleton = () => {
  return (
    <div className="rounded-3xl border border-ink/10 bg-white/90 p-4 shadow-soft">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
};

export default ProblemRowSkeleton;
