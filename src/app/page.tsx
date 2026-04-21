export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Boulders Creators</h1>
        <p className="text-muted">Invite-only content creator platform</p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
          >
            Log in
          </a>
        </div>
        <p className="font-mono text-sm text-muted mt-8">
          DM Mono for prices and metadata
        </p>
      </div>
    </main>
  );
}
