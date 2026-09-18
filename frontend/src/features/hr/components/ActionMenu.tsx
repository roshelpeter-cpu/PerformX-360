// Appraisal Cycle — row action menu
// Portals the menu to document.body with fixed coordinates so "View details"
// is never clipped by table/card overflow or stacking contexts.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const MENU_WIDTH = 192;

function computeMenuPosition(
  buttonRect: DOMRect,
  menuHeight: number
): { top: number; left: number } {
  const spaceBelow = window.innerHeight - buttonRect.bottom;
  const openUpward =
    spaceBelow < menuHeight + 8 && buttonRect.top > spaceBelow;

  let top = openUpward
    ? Math.max(8, buttonRect.top - menuHeight - 4)
    : buttonRect.bottom + 4;

  // Keep the menu fully within the viewport vertically.
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - menuHeight - 8);
  }

  let left = buttonRect.right - MENU_WIDTH;
  left = Math.min(left, window.innerWidth - MENU_WIDTH - 8);
  left = Math.max(8, left);

  return { top, left };
}

export function ActionMenu({
  items,
}: {
  items: Array<{ label: string; onClick: () => void; hidden?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = items.filter((item) => !item.hidden);

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const measuredHeight =
      menuRef.current?.offsetHeight ?? 48 + visible.length * 40;
    setCoords(computeMenuPosition(rect, measuredHeight));
  }

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    // Re-measure after paint once the portal menu has real height.
    const id = requestAnimationFrame(() => placeMenu());
    return () => cancelAnimationFrame(id);
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: Event) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setCoords(null);
    }

    function onReposition() {
      placeMenu();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCoords(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, visible.length]);

  if (visible.length === 0) return null;

  function toggle(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      setOpen(false);
      setCoords(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords(computeMenuPosition(rect, 48 + visible.length * 40));
    }
    setOpen(true);
  }

  const menu =
    open && coords ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[9999] w-48 rounded-xl border border-stone-200 bg-white p-1 shadow-xl dark:border-stone-700 dark:bg-stone-900"
        style={{ top: coords.top, left: coords.left }}
      >
        {visible.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setCoords(null);
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <Button
        ref={buttonRef}
        type="button"
        size="icon"
        variant="ghost"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {menu && typeof document !== "undefined"
        ? createPortal(menu, document.body)
        : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center dark:border-stone-700 dark:bg-stone-900">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-stone-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export const fieldClass =
  "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm dark:border-stone-700 dark:bg-stone-950";
