export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state-loading">
      <span className="spinner" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state state-empty">
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state state-error" role="alert">
      {message}
    </div>
  );
}
