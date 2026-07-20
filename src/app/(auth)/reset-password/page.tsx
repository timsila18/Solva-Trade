import { AuthCard } from "@/components/auth/auth-card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Use a strong password that is not shared with another service."
      mode="reset"
      error={params.error}
      message={params.message}
    />
  );
}
