import { useLocation } from "react-router-dom";
import WorkspacePlaceholderPage from "@/features/dashboard/pages/WorkspacePlaceholderPage";

const COPY: Record<string, { title: string; description: string }> = {
  "/workspace/employees": {
    title: "Employees",
    description:
      "Employee management will be added in a later stage. Existing appraisal-cycle employee views remain available from Appraisal Cycles.",
  },
  "/workspace/hr-groups": {
    title: "HR Groups & Teams",
    description:
      "Open an appraisal cycle and use the HR Groups & Teams tab for the existing working view.",
  },
  "/workspace/reports": {
    title: "Performance Reports",
    description: "Organisation performance reports are not part of this release.",
  },
  "/workspace/meetings": {
    title: "Meetings",
    description: "Meeting scheduling will be available in a later stage.",
  },
  "/workspace/learning": {
    title: "Learning & Development",
    description: "Learning resources will be available in a later stage.",
  },
  "/workspace/settings": {
    title: "Settings",
    description: "Workspace settings will be available in a later stage.",
  },
  "/workspace/help": {
    title: "Help & Support",
    description: "Contact your HR team if you need assistance using PerformX 360°.",
  },
};

export default function WorkspacePlaceholderRoute() {
  const { pathname } = useLocation();
  const copy = COPY[pathname] ?? {
    title: "Coming soon",
    description: "This area is not available yet.",
  };
  return (
    <WorkspacePlaceholderPage title={copy.title} description={copy.description} />
  );
}
