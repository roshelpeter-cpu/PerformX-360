// Appraisal Cycle — row action menu
// Fixed positioning avoids clipping inside overflow-x table wrappers
// (list Actions / View details dropdown must remain fully clickable).

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActionMenu({
  items,
}: {
  items: Array<{ label: string; onClick: () => void; hidden?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visible = items.filter((item) => !item.hidden);

  useEffect(() => {
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
      if (!open || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
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
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(true);
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        ref={buttonRef}
        type="button"
        size="icon"
        variant="ghost"
        aria-label="More actions"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && coords ? (
        <div
          ref={menuRef}
          className="fixed z-[80] w-48 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          style={{ top: coords.top, right: coords.right }}
        >
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
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
      ) : null}
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
