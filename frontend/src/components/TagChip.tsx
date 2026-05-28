type TagChipProps = {
  label: string;
};

const TagChip = ({ label }: TagChipProps) => {
  return (
    <span className="rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs text-ink/70">
      {label}
    </span>
  );
};

export default TagChip;
