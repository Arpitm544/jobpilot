// Skeleton for analytics page
export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 h-16" />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6 w-full">
        <div className="h-9 w-48 rounded-lg bg-white/5 animate-pulse" />
        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
        {/* Chart area */}
        <div className="h-64 rounded-xl bg-white/5 animate-pulse border border-white/5" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          <div className="h-48 rounded-xl bg-white/5 animate-pulse border border-white/5" />
        </div>
      </main>
    </div>
  );
}
