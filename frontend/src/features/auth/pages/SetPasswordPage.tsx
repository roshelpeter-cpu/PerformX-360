import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthVisualFrame from "@/features/auth/components/AuthVisualFrame";
import { useChangePassword } from "@/features/auth/hooks/useAuth";
import { ApiClientError } from "@/services/api/client";

const setPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((value) => value.newPassword === value.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

const loginInputClass =
  "border-stone-400 bg-white text-stone-900 placeholder:text-stone-500 dark:border-stone-700 dark:bg-[#090807] dark:text-stone-100 dark:placeholder:text-stone-500";

export default function SetPasswordPage() {
  const changePassword = useChangePassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword.mutateAsync(values);
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : "Unable to save your new password. Please try again.";
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <AuthVisualFrame>
      <div className="w-full rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(28,25,23,0.12)] backdrop-blur-xl sm:p-8 dark:border-stone-700/70 dark:bg-stone-950/80">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-stone-900 dark:text-white">
            Set New Password
          </h2>
          <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
            Create a permanent password to continue to your dashboard.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-stone-800 dark:text-stone-200">
              New Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 dark:text-stone-400" />
              <Input
                id="newPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter a new password"
                aria-invalid={Boolean(errors.newPassword)}
                className={`px-10 ${loginInputClass}`}
                {...register("newPassword")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword ? (
              <p className="text-sm text-red-500">{errors.newPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmNewPassword"
              className="text-stone-800 dark:text-stone-200"
            >
              Confirm New Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 dark:text-stone-400" />
              <Input
                id="confirmNewPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm your new password"
                aria-invalid={Boolean(errors.confirmNewPassword)}
                className={`px-10 ${loginInputClass}`}
                {...register("confirmNewPassword")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                onClick={() => setShowConfirm((value) => !value)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmNewPassword ? (
              <p className="text-sm text-red-500">
                {errors.confirmNewPassword.message}
              </p>
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
                Saving...
              </>
            ) : (
              "Save Permanent Password"
            )}
          </Button>
        </form>
      </div>
    </AuthVisualFrame>
  );
}
