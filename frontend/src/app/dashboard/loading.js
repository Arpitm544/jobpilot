// Skeleton for dashboard/pipeline page
export default function DashboardLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 h-16" />
      <main className="flex-1 px-4 sm:px-8 py-6 max-w-screen-2xl mx-auto w-full">
        {/* Header */}
        <div className="h-8 w-56 rounded-lg bg-white/5 animate-pulse mb-6" />
        {/* Kanban columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="min-w-[260px] rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
              <div className="h-5 w-28 rounded-md bg-white/5 animate-pulse" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-20 rounded-lg bg-white/5 animate-pulse border border-white/5" />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
