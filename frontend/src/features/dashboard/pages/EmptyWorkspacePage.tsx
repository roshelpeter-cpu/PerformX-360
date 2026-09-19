import DashboardLayout from "@/app/layouts/DashboardLayout";

export default function EmptyWorkspacePage() {
  return (
    <DashboardLayout>
      <div className="rounded-[28px] border border-stone-200 bg-white px-8 py-20 text-center dark:border-stone-800 dark:bg-stone-950">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-white">
          Welcome to PerformX 360°
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-stone-500">
          Use Profile to view your employee information, or open Appraisal
          Cycles from the sidebar to continue your appraisal work.
        </p>
      </div>
    </DashboardLayout>
  );
}
