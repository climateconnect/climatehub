import { ClipboardEvent, DragEvent, KeyboardEvent, useCallback, useState } from "react";

type UseImageDropOptions = {
  // eslint-disable-next-line no-unused-vars
  onFileSelected: (file: File) => void;
  // Called on Enter/Space when the zone is focused — the keyboard equivalent
  // of whatever the zone's onClick does (usually opening the file picker).
  // Omit it when the zone already wraps a native, independently focusable
  // control (e.g. a <button>) that provides keyboard access on its own —
  // adding it there would create a duplicate, nested tab stop.
  onActivate?: () => void;
};

/**
 * Shared hook for HTML5 drag-and-drop and clipboard-paste image handling.
 *
 * Returns drag/paste/keydown event handlers and the current drag-over state
 * so consumers can render a visual highlight. `onPaste` and `onKeyDown`
 * should be attached to a focusable element (e.g. `tabIndex={0}`) — `onPaste`
 * is intentionally scoped to that element rather than a global `window`
 * listener, so it does not fire ambiguously when a page has more than one
 * drop zone. The hook does NOT validate file types or enforce size limits —
 * that is the consumer's responsibility, matching the existing
 * click-to-upload behavior.
 */
export default function useImageDrop({ onFileSelected, onActivate }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    // dragleave bubbles from whichever nested element (e.g. an icon) the
    // pointer was last over, even while still inside the drop zone. Only
    // clear the highlight once the pointer has actually left the zone,
    // i.e. relatedTarget is no longer a descendant of the zone itself.
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget?.contains?.(relatedTarget)) {
      return;
    }
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      onFileSelected(files[0]);
    },
    [onFileSelected]
  );

  const onPaste = useCallback(
    (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      event.preventDefault();
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!onActivate) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
    [onActivate]
  );

  return { isDragOver, onDragOver, onDragLeave, onDrop, onPaste, onKeyDown };
}
