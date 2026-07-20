import { AuthCard } from "@/components/auth/auth-card";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Accept invitation"
      subtitle="Securely join the business workspace you were invited to."
      mode="invitation"
      error={params.error}
      message={params.message}
    />
  );
}
