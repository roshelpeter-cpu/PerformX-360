import { CalendarDays } from "lucide-react";
import DashboardLayout from "@/app/layouts/DashboardLayout";

export default function MeetingPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DashboardLayout>
      <div className="rounded-[28px] border border-stone-200 bg-white px-6 py-16 text-center dark:border-stone-800 dark:bg-stone-950">
        <CalendarDays className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-4 text-2xl font-semibold text-stone-900 dark:text-white">{title}</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-stone-500">{description}</p>
      </div>
    </DashboardLayout>
  );
}
