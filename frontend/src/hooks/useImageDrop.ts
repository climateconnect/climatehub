import { DragEvent, useCallback, useState } from "react";

type UseImageDropOptions = {
  // eslint-disable-next-line no-unused-vars
  onFileSelected: (file: File) => void;
};

/**
 * Shared hook for HTML5 drag-and-drop image handling.
 *
 * Returns drag event handlers and the current drag-over state so consumers
 * can render a visual highlight. The hook does NOT validate file types or
 * enforce size limits — that is the consumer's responsibility, matching the
 * existing click-to-upload behavior.
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

  return { isDragOver, onDragOver, onDragLeave, onDrop };
}
