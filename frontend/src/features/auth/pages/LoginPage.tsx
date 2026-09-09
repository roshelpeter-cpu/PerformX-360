import AuthVisualFrame from "@/features/auth/components/AuthVisualFrame";
import LoginForm from "@/features/auth/components/LoginForm";
import { useLogin } from "@/features/auth/hooks/useAuth";
import type { LoginFormValues } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  const login = useLogin();

  const handleSubmit = async (values: LoginFormValues) => {
    await login.mutateAsync({
      employeeId: values.employeeId,
      password: values.password,
    });
  };

  return (
    <AuthVisualFrame>
      <LoginForm onSubmit={handleSubmit} />
    </AuthVisualFrame>
  );
}
