"use client";

import { useEffect, useId, useRef } from "react";
import Icon from "./Icon";
import IconButton from "./IconButton";

/**
 * A styled file input.
 *
 * The native control renders its own button and "No file chosen" text, which
 * no amount of `file:` utilities can reach — it reads as an unstyled form in
 * the middle of a designed one. The real input is kept (visually hidden, so it
 * stays keyboard reachable and screen-reader announced) and a label drives it.
 */
export default function FilePicker({
  accept,
  file,
  onSelect,
  buttonLabel = "Choose file",
  emptyLabel = "No file selected",
  disabled = false,
  className = "",
}: {
  accept: string;
  file: File | null;
  onSelect: (file: File | null) => void;
  buttonLabel?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // A parent that clears `file` after an upload must also clear the native
  // input, or selecting the very same file again fires no change event.
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = "";
  }, [file]);

  function clear() {
    onSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
      <label
        htmlFor={id}
        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg
          border border-steel-200 bg-white px-3 py-2 text-sm font-semibold text-steel-700
          shadow-sm transition-all duration-200
          hover:border-steel-300 hover:bg-steel-50 hover:text-ink active:translate-y-px
          ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <Icon name="plus" className="h-4 w-4" />
        {buttonLabel}
      </label>

      {file ? (
        <>
          <span className="min-w-0 flex-1 truncate text-sm text-steel-600">
            {file.name}
          </span>
          <IconButton icon="close" label="Clear selection" onClick={clear} />
        </>
      ) : (
        <span className="truncate text-sm text-steel-400">{emptyLabel}</span>
      )}
    </div>
  );
}
