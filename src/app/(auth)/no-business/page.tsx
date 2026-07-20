import Link from "next/link";

export default function NoBusinessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="max-w-lg rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold">No business workspace found</h1>
        <p className="mt-3 text-slate-600">
          Create a business or accept an invitation before using the main workspace.
        </p>
        <Link href="/onboarding" className="mt-5 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-white">
          Start onboarding
        </Link>
      </section>
    </main>
  );
}
