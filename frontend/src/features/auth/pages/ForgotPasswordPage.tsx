import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/features/auth/hooks/useAuth";
import AuthVisualFrame from "@/features/auth/components/AuthVisualFrame";
import { ApiClientError } from "@/services/api/client";
import { useState } from "react";

const forgotPasswordSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

const inputClass =
  "border-stone-400 bg-white text-stone-900 placeholder:text-stone-500 dark:border-stone-700 dark:bg-[#090807] dark:text-stone-100 dark:placeholder:text-stone-500";

const cardClass =
  "w-full rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(28,25,23,0.12)] backdrop-blur-xl sm:p-8 dark:border-stone-700/70 dark:bg-stone-950/80";

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { employeeId: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await forgotPassword.mutateAsync(values);
      setOneTimePassword(result.oneTimePassword);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Unable to verify that Employee ID. Please try again.";
      setFormError(message);
    }
  });

  return (
    <AuthVisualFrame>
      <div className={cardClass}>
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-stone-900 dark:text-white">
            {oneTimePassword ? "One-time password" : "Forgot your password?"}
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            {oneTimePassword
              ? "This is a temporary one-time password."
              : "Enter your Employee ID to receive a temporary one-time password."}
          </p>
        </div>

        {oneTimePassword ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <p>Your one-time password is: {oneTimePassword}</p>
              <p className="mt-2">
                Use this password to sign in. You will be required to create a
                permanent password after signing in.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="text-stone-800 dark:text-stone-200">
                Employee ID
              </Label>
              <Input
                id="employeeId"
                placeholder="e.g. EMP000001"
                aria-invalid={Boolean(errors.employeeId)}
                className={inputClass}
                {...register("employeeId")}
              />
              {errors.employeeId ? (
                <p className="text-sm text-red-500">{errors.employeeId.message}</p>
              ) : null}
            </div>

            {formError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {formError}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        )}

        {!oneTimePassword ? (
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-amber-700 hover:text-amber-600 dark:text-amber-300"
            >
              Back to Sign In
            </Link>
          </div>
        ) : null}
      </div>
    </AuthVisualFrame>
  );
}
