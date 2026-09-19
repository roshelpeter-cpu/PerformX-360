import DashboardLayout from "@/app/layouts/DashboardLayout";

export default function WorkspacePlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DashboardLayout>
      <div className="rounded-[28px] border border-stone-200 bg-white px-8 py-16 dark:border-stone-800 dark:bg-stone-950">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-500">{description}</p>
      </div>
    </DashboardLayout>
  );
}
