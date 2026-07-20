import { AuthCard } from "@/components/auth/auth-card";

export default async function CreateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      subtitle="Start with your profile, then create your first business."
      mode="create-account"
      error={params.error}
      message={params.message}
    />
  );
}
