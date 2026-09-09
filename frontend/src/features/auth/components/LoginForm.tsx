// Login Card
// Handles the administrator/employee login form and authentication actions.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, Moon, Sun, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/services/api/client";
import { useThemeStore } from "@/store/themeStore";

const loginSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => Promise<void>;
}

const loginInputClass =
  "border-stone-400 bg-white text-stone-900 placeholder:text-stone-500 dark:border-stone-700 dark:bg-[#090807] dark:text-stone-100 dark:placeholder:text-stone-500";

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeId: "",
      password: "",
    },
  });

  const submitHandler = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);
        toast.error(error.message);
        return;
      }
      const message = "Unable to sign in. Please try again.";
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <div className="w-full rounded-3xl border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(28,25,23,0.12)] backdrop-blur-xl sm:p-8 dark:border-stone-700/70 dark:bg-stone-950/80">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-stone-900 dark:text-white">
          Welcome Back
        </h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Sign in to continue to Altrium PerformX 360°
        </p>
      </div>

      <form onSubmit={submitHandler} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="employeeId" className="text-stone-800 dark:text-stone-200">
            Employee ID
          </Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 dark:text-stone-400" />
            <Input
              id="employeeId"
              autoComplete="username"
              placeholder="Enter your employee ID"
              aria-invalid={Boolean(errors.employeeId)}
              className={`pl-10 ${loginInputClass}`}
              {...register("employeeId")}
            />
          </div>
          {errors.employeeId ? (
            <p className="text-sm text-red-500">{errors.employeeId.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-stone-800 dark:text-stone-200">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500 dark:text-stone-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={Boolean(errors.password)}
              className={`px-10 ${loginInputClass}`}
              {...register("password")}
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
          {errors.password ? (
            <p className="text-sm text-red-500">{errors.password.message}</p>
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
              Signing In...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <div className="mt-6 text-sm text-stone-600 dark:text-stone-300">
        <Link
          to="/forgot-password"
          className="font-semibold text-amber-700 hover:text-amber-600 dark:text-amber-300"
        >
          Forgot your password?
        </Link>
      </div>

      <div className="mt-6 flex justify-center">
        <div className="inline-flex rounded-full border border-stone-300 bg-stone-100 p-1 dark:border-stone-700 dark:bg-stone-900">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              theme === "light"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-400"
            }`}
            onClick={() => setTheme("light")}
          >
            <Sun className="h-3.5 w-3.5" />
            Light
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
              theme === "dark"
                ? "bg-stone-800 text-amber-200 shadow-sm"
                : "text-stone-500"
            }`}
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-3.5 w-3.5" />
            Dark
          </button>
        </div>
      </div>
    </div>
  );
}

export type { LoginFormValues };
