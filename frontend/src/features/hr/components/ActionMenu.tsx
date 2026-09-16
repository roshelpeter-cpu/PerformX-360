// Appraisal Cycle — row action menu
// Renders the dropdown in a document.body portal with fixed coordinates so
// "View details" is never clipped by table overflow containers.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const MENU_WIDTH = 192;
const MENU_ESTIMATE_HEIGHT = 220;

export function ActionMenu({
  items,
}: {
  items: Array<{ label: string; onClick: () => void; hidden?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = items.filter((item) => !item.hidden);

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < MENU_ESTIMATE_HEIGHT && rect.top > spaceBelow;
    let top = openUpward
      ? Math.max(8, rect.top - MENU_ESTIMATE_HEIGHT - 4)
      : rect.bottom + 4;

    let left = rect.right - MENU_WIDTH;
    left = Math.min(left, window.innerWidth - MENU_WIDTH - 8);
    left = Math.max(8, left);

    setCoords({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;

    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onReposition() {
      placeMenu();
    }

    document.addEventListener("mousedown", onClick);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  if (visible.length === 0) return null;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }

  const menu =
    open && coords ? (
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[200] w-48 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        style={{ top: coords.top, left: coords.left }}
      >
        {visible.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
            onClick={() => {
              setOpen(false);
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
