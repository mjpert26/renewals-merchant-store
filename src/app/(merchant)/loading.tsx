export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-8">
      <div className="space-y-3">
        <div className="skeleton h-4 w-32 rounded-full" />
        <div className="skeleton h-9 w-72 max-w-full rounded-xl" />
        <div className="skeleton h-4 w-96 max-w-full rounded-full" />
      </div>
      <div className="skeleton h-64 rounded-[24px]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-[20px] border border-line p-2.5">
            <div className="skeleton aspect-[4/3] rounded-[14px]" />
            <div className="skeleton h-4 w-2/3 rounded-full" />
            <div className="skeleton h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading your rewards…
      </span>
    </div>
  );
}
