import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import ThemeToggle from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  formatRoleLabel,
  getDashboardPathForRole,
  getEmployeeManagementPathForRole,
  getMeetingsPathForRole,
  getNotificationsPathForRole,
  getPdpPathForRole,
  getProfilePathForRole,
  isHrStaffRole,
} from "@/constants/roles";
import type { UserRole } from "@/features/auth/types";
import SessionTimeoutDialog from "@/features/auth/components/SessionTimeoutDialog";
import { useLogout, useMyNotifications } from "@/features/auth/hooks/useAuth";
import { useSessionTimeout } from "@/features/auth/hooks/useSessionTimeout";
import { getProfilePortraitUrl } from "@/features/profile/portrait";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: Array<{ label: string; to: string }>;
}

function navItemsForRole(role: string | undefined): NavItem[] {
  const dashboard: NavItem = {
    label: "Dashboard",
    to: role ? getDashboardPathForRole(role as UserRole) : "/",
    icon: LayoutDashboard,
  };
  const profile: NavItem = {
    label: "Profile",
    to: role ? getProfilePathForRole(role as UserRole) : "/",
    icon: UserRound,
  };
  const employeeManagement: NavItem = {
    label: "Employee Management",
    to: role ? getEmployeeManagementPathForRole(role as UserRole) : "/",
    icon: Users,
  };
  const appraisalCycle: NavItem = {
    label: "Appraisal Cycle",
    to: "/hr/appraisal-cycles",
    icon: CalendarRange,
  };
  const notifications: NavItem = {
    label: "Notifications",
    to: role ? getNotificationsPathForRole(role as UserRole) : "/",
    icon: Bell,
  };
  const meetingsBase = role ? getMeetingsPathForRole(role as UserRole) : "/";
  const meetings: NavItem = {
    label: "Meetings",
    to: `${meetingsBase}/performance-planning`,
    icon: CalendarDays,
    children: [
      { label: "Performance Planning", to: `${meetingsBase}/performance-planning` },
      { label: "Follow-up Meetings", to: `${meetingsBase}/follow-up` },
      { label: "Other Meetings", to: `${meetingsBase}/other` },
    ],
  };
  const pdpBase = role ? getPdpPathForRole(role as UserRole) : "/";
  const pdpNav: NavItem = {
    label: "PDP Management",
    to: pdpBase,
    icon: ClipboardList,
    children:
      role === "EMPLOYEE"
        ? undefined
        : [
            { label: role === "SUPERVISOR" ? "Team PDPs" : "All PDPs", to: pdpBase },
          ],
  };
  const myPdpNav: NavItem = {
    label: "My PDP",
    to: "/employee/pdp",
    icon: ClipboardList,
  };

  if (role && isHrStaffRole(role as UserRole)) {
    return [dashboard, appraisalCycle, employeeManagement, pdpNav, meetings, notifications, profile];
  }

  if (role === "EMPLOYEE") {
    return [dashboard, myPdpNav, meetings, notifications, profile];
  }

  if (role === "SUPERVISOR") {
    return [dashboard, employeeManagement, pdpNav, meetings, notifications, profile];
  }

  return [dashboard];
}

export default function DashboardLayout({ children }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { showWarning, staySignedIn, isExtending } = useSessionTimeout(
    Boolean(user)
  );
  const notificationsQuery = useMyNotifications(Boolean(user));
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const items = navItemsForRole(user?.role);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900 dark:bg-[#0c0a09] dark:text-stone-100">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950 md:flex md:flex-col",
            sidebarCollapsed ? "w-20" : "w-72"
          )}
        >
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-5 dark:border-stone-800">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-amber-700 dark:text-amber-300">
                  Altrium
                </p>
                <p className="font-semibold">PerformX 360°</p>
              </div>
            ) : (
              <span className="mx-auto text-sm font-semibold text-amber-600">PX</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed((value) => !value)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {items.map((item) => {
              const childActive = item.children?.some((child) => location.pathname.startsWith(child.to));
              return (
                <div key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.label === "Dashboard"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                        isActive || childActive
                          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-950"
                          : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!sidebarCollapsed ? (
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span>{item.label}</span>
                        {item.label === "Notifications" && unreadCount > 0 ? (
                          <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {unreadCount}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </NavLink>
                  {!sidebarCollapsed && item.children && childActive
                    ? item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          className={({ isActive }) =>
                            cn(
                              "ml-8 mt-1 block rounded-lg px-3 py-1.5 text-sm",
                              isActive
                                ? "bg-stone-100 font-medium text-stone-900 dark:bg-stone-800 dark:text-white"
                                : "text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-900"
                            )
                          }
                        >
                          {child.label}
                        </NavLink>
                      ))
                    : null}
                </div>
              );
            })}
          </nav>

          <div className="space-y-3 border-t border-stone-200 p-4 dark:border-stone-800">
            {!sidebarCollapsed ? (
              <div className="rounded-2xl bg-stone-50 px-4 py-4 text-sm font-semibold leading-5 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
                People
                <br />
                Process
                <br />
                Progress.
                <div className="mt-3 h-0.5 w-10 bg-amber-400" />
              </div>
            ) : null}
            {user?.role === "LEADERSHIP" ? (
            <NavLink
              to="/workspace/help"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
            >
              <CircleHelp className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? <span>Help & Support</span> : null}
            </NavLink>
            ) : null}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
              onClick={() => logout.mutate()}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed ? <span>Logout</span> : null}
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="relative hidden max-w-xl flex-1 sm:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    type="search"
                    placeholder="Search for employees, cycles, reports..."
                    className="h-10 w-full rounded-full border border-stone-200 bg-stone-50 pl-10 pr-4 text-sm dark:border-stone-700 dark:bg-stone-950"
                    aria-label="Search"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                    title="Notifications"
                    onClick={() => {
                      if (user) {
                        navigate(getNotificationsPathForRole(user.role));
                        setNotificationsOpen(false);
                        return;
                      }
                      setNotificationsOpen((value) => !value);
                    }}
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                  {notificationsOpen ? (
                    <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl dark:border-stone-700 dark:bg-stone-900">
                      <p className="px-2 text-sm font-medium">Notifications</p>
                      <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="px-2 py-4 text-sm text-stone-500">
                            No notifications yet.
                          </p>
                        ) : (
                          notifications.slice(0, 8).map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl px-2 py-2 text-sm"
                            >
                              <p className="font-medium">{item.title}</p>
                              <p className="mt-1 text-xs text-stone-500">
                                {item.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left dark:border-stone-700 dark:bg-stone-900"
                    onClick={() => setProfileOpen((value) => !value)}
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                  >
                    {user?.employeeId ? (
                      <img
                        src={getProfilePortraitUrl(user.employeeId)}
                        alt={user.name}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-sm font-semibold text-stone-950">
                        {user?.name?.charAt(0) ?? "U"}
                      </div>
                    )}
                    <div className="hidden sm:block">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {user ? formatRoleLabel(user.role) : "User"}
                      </p>
                    </div>
                    <ChevronDown className="hidden h-4 w-4 sm:block" />
                  </button>

                  {profileOpen ? (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-700 dark:bg-stone-900"
                      role="menu"
                    >
                      <div className="border-b border-stone-100 px-3 py-2 dark:border-stone-800">
                        <p className="text-sm font-medium">{user?.name}</p>
                        <p className="text-xs text-stone-500">{user?.employeeId}</p>
                      </div>
                      {user && user.role !== "LEADERSHIP" ? (
                        <Link
                          to={getProfilePathForRole(user.role)}
                          className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
                          role="menuitem"
                          onClick={() => setProfileOpen(false)}
                        >
                          <UserRound className="h-4 w-4" />
                          Profile
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => logout.mutate()}
                        role="menuitem"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>

      <SessionTimeoutDialog
        open={showWarning}
        onStaySignedIn={staySignedIn}
        isExtending={isExtending}
      />
    </div>
  );
}
