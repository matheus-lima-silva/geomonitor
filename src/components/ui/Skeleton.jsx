/**
 * Placeholder animado para estados de carregamento.
 *
 * Props:
 *   className — classes adicionais (para definir w/h)
 *   lines     — repete N linhas de skeleton (util para listas de texto)
 */
export default function Skeleton({ className = 'h-4 w-full', lines = 1 }) {
  if (lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`animate-pulse rounded-md bg-slate-200 ${i === lines - 1 ? 'w-3/4' : 'w-full'} h-4`}
          />
        ))}
      </div>
    );
  }
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}

/**
 * Skeleton para card de foto (4:3)
 */
export function PhotoCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="animate-pulse bg-slate-200 aspect-[4/3] w-full" />
      <div className="p-3 flex flex-col gap-2">
        <div className="animate-pulse h-4 rounded bg-slate-200 w-3/4" />
        <div className="animate-pulse h-8 rounded-md bg-slate-200 w-full" />
        <div className="animate-pulse h-8 rounded-md bg-slate-200 w-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton para linha de lista (artigo de dossie, composto, etc)
 */
export function ListItemSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="animate-pulse h-4 rounded bg-slate-200 w-1/3" />
        <div className="animate-pulse h-6 rounded-full bg-slate-200 w-16" />
      </div>
      <div className="animate-pulse h-3 rounded bg-slate-200 w-2/3" />
      <div className="mt-2 flex gap-2">
        <div className="animate-pulse h-3 rounded-full bg-slate-200 w-20" />
        <div className="animate-pulse h-3 rounded-full bg-slate-200 w-20" />
      </div>
    </div>
  );
}
