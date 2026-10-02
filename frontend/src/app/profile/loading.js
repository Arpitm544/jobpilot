// Skeleton for profile page
export default function ProfileLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 h-16" />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6 w-full">
        <div className="h-9 w-64 rounded-lg bg-white/5 animate-pulse" />
        {/* Tabs skeleton */}
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
        {/* Form fields skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
        <div className="h-32 rounded-xl bg-white/5 animate-pulse border border-white/5" />
      </main>
    </div>
  );
}
