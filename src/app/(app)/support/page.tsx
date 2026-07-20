const supportAreas = [
  ["Support cases", "Open, waiting, resolved and closed cases with priority and assignment."],
  ["Controlled support access", "Tenant-sensitive access requires approved scoped grants with expiry and audit."],
  ["Training", "Owner, Manager, Cashier, Salesperson, Storekeeper, Driver and Accountant training foundations."],
  ["Notification preferences", "In-app, email, SMS foundation and mandatory critical service notices."],
  ["Data export", "Owner-requested business export workflow with expiry and audit history."],
  ["Account closure", "Cancellation, retention, legal hold and scheduled deletion workflow."],
];

const communicationTypes = [
  "Verification",
  "Invitation",
  "Password reset",
  "Trial reminders",
  "Billing invoices",
  "Payment confirmations",
  "Failed-payment notices",
  "Subscription changes",
  "Support updates",
  "Critical security alerts",
  "Scheduled reports",
  "Tax reminders",
  "Approval reminders",
  "SMS payment reminders",
  "SMS security alerts",
];

export default function SupportPage() {
  return (
    <div className="pb-20">
      <div>
        <p className="text-sm font-semibold text-emerald-700">Support operations</p>
        <h1 className="mt-1 text-3xl font-semibold">Support Centre</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Customer support, training, notification preferences, data export and account-closure foundations for pilot tenants.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {supportAreas.map(([title, body]) => (
          <article key={title} className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-3 text-sm text-slate-600">{body}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Email and SMS Architecture</h2>
        <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {communicationTypes.map((type) => (
            <div key={type} className="rounded-md bg-slate-100 px-3 py-3 text-sm text-slate-700">{type}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
