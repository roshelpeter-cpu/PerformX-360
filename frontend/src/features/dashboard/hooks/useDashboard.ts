import { useQuery } from "@tanstack/react-query";
import { getMyDashboardRequest } from "../services/dashboard.api";
import { useAuthStore } from "@/store/authStore";

export function useMyDashboard() {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["dashboard", "me", userId],
    queryFn: async () => (await getMyDashboardRequest()).dashboard,
    enabled: Boolean(userId),
    staleTime: 0,
  });
}
