export default function AdminInvitesLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-10 w-40 bg-surface rounded-lg mb-2" />
          <div className="h-5 w-32 bg-surface rounded" />
        </div>
        <div className="h-10 w-36 bg-surface rounded-lg" />
      </div>

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-border/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
