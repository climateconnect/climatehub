import { act, renderHook } from "@testing-library/react";
import useImageDrop from "./useImageDrop";

function makeDragEvent(files: File[]) {
  return {
    preventDefault: jest.fn(),
    dataTransfer: { files },
  } as any;
}

function makeClipboardItem(type: string, file: File | null) {
  return { type, getAsFile: () => file };
}

function makeClipboardEvent(items: { type: string; getAsFile: () => File | null }[]) {
  return {
    preventDefault: jest.fn(),
    clipboardData: { items },
  } as any;
}

function makeKeyEvent(key: string) {
  return { key, preventDefault: jest.fn() } as any;
}

describe("useImageDrop", () => {
  it("starts with isDragOver false", () => {
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn() }));
    expect(result.current.isDragOver).toBe(false);
  });

  it("sets isDragOver to true on drag-over", () => {
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn() }));
    const event = makeDragEvent([]);
    act(() => result.current.onDragOver(event));
    expect(result.current.isDragOver).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("sets isDragOver back to false on drag-leave", () => {
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn() }));
    act(() => result.current.onDragOver(makeDragEvent([])));
    expect(result.current.isDragOver).toBe(true);
    act(() => result.current.onDragLeave(makeDragEvent([])));
    expect(result.current.isDragOver).toBe(false);
  });

  it("calls onFileSelected with the dropped file and resets isDragOver", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    act(() => result.current.onDragOver(makeDragEvent([])));
    const file = new File(["content"], "photo.png", { type: "image/png" });
    act(() => result.current.onDrop(makeDragEvent([file])));
    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(result.current.isDragOver).toBe(false);
  });

  it("uses only the first file when multiple files are dropped", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    const file1 = new File(["a"], "first.png", { type: "image/png" });
    const file2 = new File(["b"], "second.png", { type: "image/png" });
    act(() => result.current.onDrop(makeDragEvent([file1, file2])));
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(file1);
  });

  it("is a no-op when no files are dropped", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    act(() => result.current.onDrop(makeDragEvent([])));
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("calls onFileSelected with the pasted image", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    const file = new File(["content"], "pasted.png", { type: "image/png" });
    const event = makeClipboardEvent([makeClipboardItem("image/png", file)]);
    act(() => result.current.onPaste(event));
    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("uses the first image item when multiple clipboard items are pasted", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    const textFile = null;
    const imageFile = new File(["b"], "second.png", { type: "image/png" });
    const event = makeClipboardEvent([
      makeClipboardItem("text/plain", textFile),
      makeClipboardItem("image/png", imageFile),
    ]);
    act(() => result.current.onPaste(event));
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(imageFile);
  });

  it("ignores non-image clipboard content", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    const event = makeClipboardEvent([makeClipboardItem("text/plain", null)]);
    act(() => result.current.onPaste(event));
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("is a no-op when the clipboard is empty", () => {
    const onFileSelected = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected }));
    const event = makeClipboardEvent([]);
    act(() => result.current.onPaste(event));
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("calls onActivate on Enter", () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn(), onActivate }));
    act(() => result.current.onKeyDown(makeKeyEvent("Enter")));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("calls onActivate on Space", () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn(), onActivate }));
    act(() => result.current.onKeyDown(makeKeyEvent(" ")));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys", () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn(), onActivate }));
    act(() => result.current.onKeyDown(makeKeyEvent("Tab")));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("onKeyDown is a safe no-op when onActivate is not provided", () => {
    const { result } = renderHook(() => useImageDrop({ onFileSelected: jest.fn() }));
    expect(() => act(() => result.current.onKeyDown(makeKeyEvent("Enter")))).not.toThrow();
  });
});
