import { AuthCard } from "@/components/auth/auth-card";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will send a secure reset link if the account exists."
      mode="forgot"
      error={params.error}
      message={params.message}
    />
  );
}
