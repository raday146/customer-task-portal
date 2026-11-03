interface Props {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span className="muted">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="pagination-buttons">
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="btn btn-ghost"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
