"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Icon from "./Icon";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  async () => false
);

/**
 * Drop-in replacement for `window.confirm`, minus the browser chrome.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this climb?", danger: true }))) return;
 */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  // Native <dialog> gives focus trapping, inertness of the page behind, and
  // Escape handling without any of it being hand-rolled.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (options && !dialog.open) dialog.showModal();
    if (!options && dialog.open) dialog.close();
  }, [options]);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  // A caller left waiting forever is worse than one told "no".
  useEffect(() => () => resolver.current?.(false), []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="confirm-title"
        onCancel={(e) => {
          e.preventDefault(); // let the close run through settle()
          settle(false);
        }}
        onClick={(e) => {
          // The dialog element itself is the backdrop; its child is the card.
          if (e.target === dialogRef.current) settle(false);
        }}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-steel-200 bg-white p-0 text-ink shadow-lift backdrop:bg-ink/35 backdrop:backdrop-blur-sm"
      >
        {options && (
          <div className="p-5">
            <div className="flex gap-3.5">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  options.danger
                    ? "bg-rose-50 text-rose-600"
                    : "bg-lake-50 text-lake-600"
                }`}
              >
                <Icon
                  name={options.danger ? "trash" : "spark"}
                  className="h-5 w-5"
                />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="font-semibold text-ink">
                  {options.title}
                </h2>
                {options.body && (
                  <p className="mt-1 text-sm leading-relaxed text-steel-600">
                    {options.body}
                  </p>
                )}
              </div>
            </div>

            {/* Cancel comes first in the DOM, so showModal() lands focus
                there rather than on the destructive action — Enter on an
                unread dialog should never delete anything. */}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => settle(false)} className="btn-secondary">
                {options.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => settle(true)}
                className={options.danger ? "btn-danger" : "btn-primary"}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
