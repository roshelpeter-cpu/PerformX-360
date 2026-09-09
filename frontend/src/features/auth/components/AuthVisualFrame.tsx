import { useEffect, useState, type ReactNode } from "react";
import AuthLayout from "@/app/layouts/AuthLayout";
import ClimbingVisual from "@/features/auth/components/ClimbingVisual";

export default function AuthVisualFrame({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return (
    <AuthLayout>
      <div className="relative min-h-screen w-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <ClimbingVisual reducedMotion={reducedMotion} />
          <div className="auth-page-fade absolute inset-0" />
        </div>

        <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10 lg:justify-end lg:px-16 xl:px-24">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </AuthLayout>
  );
}
