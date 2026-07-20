import { AuthCard } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  return <AuthCard title="Reset your password" subtitle="We will send a secure reset link if the account exists." mode="forgot" />;
}
