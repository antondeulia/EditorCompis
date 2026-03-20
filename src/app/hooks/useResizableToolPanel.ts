import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "@/features/timeline/lib/clamp";

interface UseResizableToolPanelOptions {
  initialWidth?: number;
  maxWidthRatio?: number;
  minWidth: number;
}

export const useResizableToolPanel = ({
  initialWidth = 360,
  maxWidthRatio = 0.5,
  minWidth,
}: UseResizableToolPanelOptions) => {
  const [toolPanelWidth, setToolPanelWidth] = useState(initialWidth);

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const getMaxWidth = useCallback(() => {
    const workspaceWidth = workspaceRef.current?.clientWidth ?? 0;
    return workspaceWidth > 0
      ? Math.max(minWidth, Math.floor(workspaceWidth * maxWidthRatio))
      : initialWidth;
  }, [initialWidth, maxWidthRatio, minWidth]);

  useEffect(() => {
    const clampWidth = () => {
      setToolPanelWidth((currentWidth) => clamp(currentWidth, minWidth, getMaxWidth()));
    };

    clampWidth();
    window.addEventListener("resize", clampWidth);

    return () => {
      window.removeEventListener("resize", clampWidth);
    };
  }, [getMaxWidth, minWidth]);

  const handleResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!workspaceRef.current) {
        return;
      }

      event.preventDefault();

      const startX = event.clientX;
      const startWidth = toolPanelWidth;
      const maxWidth = getMaxWidth();

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        setToolPanelWidth(clamp(startWidth + delta, minWidth, maxWidth));
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [getMaxWidth, minWidth, toolPanelWidth],
  );

  return {
    handleResizeStart,
    toolPanelWidth,
    workspaceRef,
  };
};
