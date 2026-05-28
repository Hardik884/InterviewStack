import Button from "./Button";

type PaginationProps = {
  page: number;
  totalPages: number;
  onNext: () => void;
  onPrev: () => void;
};

const Pagination = ({ page, totalPages, onNext, onPrev }: PaginationProps) => {
  return (
    <div className="flex items-center justify-between text-xs">
      <Button variant="ghost" onClick={onPrev} disabled={page <= 1}>
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button
        variant="ghost"
        onClick={onNext}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  );
};

export default Pagination;
