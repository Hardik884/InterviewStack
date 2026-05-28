const Loader = ({ label = "Loading" }) => {
  return (
    <div className="flex items-center gap-2 text-xs text-ink/60">
      <span className="h-2 w-2 animate-pulse rounded-full bg-accent"></span>
      {label}
    </div>
  );
};

export default Loader;
