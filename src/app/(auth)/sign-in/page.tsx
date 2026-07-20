import { AuthCard } from "@/components/auth/auth-card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue to your business workspace."
      mode="sign-in"
      error={params.error}
      message={params.message}
    />
  );
}
