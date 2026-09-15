import { act, renderHook } from "@testing-library/react";
import useImageDrop from "./useImageDrop";

function makeDragEvent(files: File[]) {
  return {
    preventDefault: jest.fn(),
    dataTransfer: { files },
  } as any;
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
});
