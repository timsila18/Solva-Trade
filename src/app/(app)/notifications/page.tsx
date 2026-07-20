const notifications = [
  "Business setup incomplete",
  "Permission changed",
  "Invitation accepted",
];

export default function NotificationsPage() {
  return (
    <div className="pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Notifications</h1>
        <button className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold">Mark all as read</button>
      </div>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white">
        {notifications.map((notification) => (
          <div key={notification} className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-semibold">{notification}</h2>
              <p className="text-sm text-slate-600">Foundational notification type wired for related actions.</p>
            </div>
            <button className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Read</button>
          </div>
        ))}
      </section>
    </div>
  );
}
