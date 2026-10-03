// Skeleton loader shown by Next.js App Router while the page suspends or loads
export default function Loading() {
  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#080c14]/90 h-16 flex items-center px-8">
        <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
        <div className="ml-auto flex gap-4">
          <div className="h-6 w-20 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-6 w-20 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-6 w-20 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
      {/* Content skeleton */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-white/5 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-white/5 animate-pulse border border-white/5" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-white/5 animate-pulse border border-white/5" />
      </main>
    </div>
  );
}
