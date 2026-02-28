import { Button } from "./button";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  class?: string;
};

export function PaginationControls(props: PaginationControlsProps) {
  return (
    <div class={`flex items-center gap-2 ${props.class || ""}`}>
      <Button
        disabled={props.currentPage === 1}
        onClick={() => props.onPageChange(Math.max(1, props.currentPage - 1))}
        size="sm"
        variant="outline"
      >
        Prev
      </Button>
      <span class="flex items-center px-2 text-sm">
        Page {props.currentPage} of {props.totalPages}
      </span>
      <Button
        disabled={props.currentPage === props.totalPages}
        onClick={() =>
          props.onPageChange(Math.min(props.totalPages, props.currentPage + 1))
        }
        size="sm"
        variant="outline"
      >
        Next
      </Button>
    </div>
  );
}
