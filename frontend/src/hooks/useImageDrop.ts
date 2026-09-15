import { ClipboardEvent, DragEvent, useCallback, useState } from "react";

type UseImageDropOptions = {
  // eslint-disable-next-line no-unused-vars
  onFileSelected: (file: File) => void;
};

/**
 * Shared hook for HTML5 drag-and-drop and clipboard-paste image handling.
 *
 * Returns drag/paste event handlers and the current drag-over state so
 * consumers can render a visual highlight. `onPaste` should be attached to a
 * focusable element (e.g. `tabIndex={0}`) — it is intentionally scoped to
 * that element rather than a global `window` listener, so it does not fire
 * ambiguously when a page has more than one drop zone. The hook does NOT
 * validate file types or enforce size limits — that is the consumer's
 * responsibility, matching the existing click-to-upload behavior.
 */
export default function useImageDrop({ onFileSelected }: UseImageDropOptions) {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
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

  return { isDragOver, onDragOver, onDragLeave, onDrop, onPaste };
}
