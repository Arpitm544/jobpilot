// Skeleton for discovery/jobs page
export default function DiscoveryLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 h-16" />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-4 w-full">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="ml-auto h-9 w-32 rounded-lg bg-white/5 animate-pulse" />
        </div>
        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        {/* Job cards */}
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
      </main>
    </div>
  );
}
