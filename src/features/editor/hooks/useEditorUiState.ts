"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { defaultSidebarWidth, defaultTimelineHeight, RightSidebarSection } from "../model/constants";
import { AssetItem, AssetKind } from "../model/types";
import { clamp, formatFileSize } from "../lib/utils";

type UseEditorUiStateParams = {
  initialAssets: AssetItem[];
};

export function useEditorUiState({ initialAssets }: UseEditorUiStateParams) {
  const assetUploadInputRef = useRef<HTMLInputElement | null>(null);
  const assetsRef = useRef<AssetItem[]>([]);
  const leftRailResizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const inspectorResizeStateRef = useRef({ startX: 0, startWidth: defaultSidebarWidth });
  const timelineResizeStateRef = useRef({ startY: 0, startHeight: defaultTimelineHeight });
  const chatScrollbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [timelineHeight, setTimelineHeight] = useState(defaultTimelineHeight);
  const [isTimelineResizing, setIsTimelineResizing] = useState(false);
  const [isLeftRailResizing, setIsLeftRailResizing] = useState(false);
  const [leftRailWidth, setLeftRailWidth] = useState(defaultSidebarWidth);
  const [isInspectorResizing, setIsInspectorResizing] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(defaultSidebarWidth);
  const [isLeftRailCollapsed, setIsLeftRailCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [activeRightSidebarSection, setActiveRightSidebarSection] = useState<RightSidebarSection>("Properties");
  const [isRightSidebarPanelOpen, setIsRightSidebarPanelOpen] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"chat" | "assets">("chat");
  const [isChatScrollbarVisible, setIsChatScrollbarVisible] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);

  const boundedInspectorWidth = Math.max(inspectorWidth, 250);

  const toggleLeftRail = useCallback(() => {
    setIsLeftRailCollapsed((prev) => !prev);
  }, []);

  const toggleInspector = useCallback(() => {
    setIsInspectorCollapsed((prev) => !prev);
  }, []);

  const handleRightSidebarSectionClick = useCallback((section: RightSidebarSection) => {
    setActiveRightSidebarSection(section);
    setIsRightSidebarPanelOpen((prev) => !(prev && activeRightSidebarSection === section));
  }, [activeRightSidebarSection]);

  const handleChatScroll = useCallback(() => {
    setIsChatScrollbarVisible(true);

    if (chatScrollbarTimerRef.current) {
      clearTimeout(chatScrollbarTimerRef.current);
    }

    chatScrollbarTimerRef.current = setTimeout(() => {
      setIsChatScrollbarVisible(false);
      chatScrollbarTimerRef.current = null;
    }, 2000);
  }, []);

  const handleAssetUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const nextAssets: AssetItem[] = Array.from(files).map((file, index) => {
      const src = URL.createObjectURL(file);
      const kind: AssetKind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("image/")
            ? "image"
            : "other";

      return {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        kind,
        src,
        revokeOnDispose: true,
        sizeLabel: formatFileSize(file.size),
      };
    });

    setAssets((prev) => [...nextAssets, ...prev]);
    event.target.value = "";
  }, []);

  function handleInspectorResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    inspectorResizeStateRef.current = {
      startX: event.clientX,
      startWidth: boundedInspectorWidth,
    };
    setIsInspectorResizing(true);
  }

  function handleLeftRailResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    leftRailResizeStateRef.current = {
      startX: event.clientX,
      startWidth: leftRailWidth,
    };
    setIsLeftRailResizing(true);
  }

  function handleTimelineResizeStart(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    timelineResizeStateRef.current = {
      startY: event.clientY,
      startHeight: timelineHeight,
    };
    setIsTimelineResizing(true);
  }

  useEffect(() => {
    return () => {
      if (chatScrollbarTimerRef.current) {
        clearTimeout(chatScrollbarTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const asset of assetsRef.current) {
        if (asset.revokeOnDispose && asset.src) {
          URL.revokeObjectURL(asset.src);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!isLeftRailResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = leftRailResizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setLeftRailWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsLeftRailResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isLeftRailResizing]);

  useEffect(() => {
    if (!isInspectorResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startX, startWidth } = inspectorResizeStateRef.current;
      const nextWidth = startWidth + (event.clientX - startX);
      setInspectorWidth(Math.max(250, nextWidth));
    }

    function stopResizing() {
      setIsInspectorResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isInspectorResizing]);

  useEffect(() => {
    if (!isTimelineResizing) {
      return;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      const { startY, startHeight } = timelineResizeStateRef.current;
      const nextHeight = startHeight - (event.clientY - startY);
      setTimelineHeight(clamp(nextHeight, 180, 560));
    }

    function stopResizing() {
      setIsTimelineResizing(false);
    }

    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);

    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isTimelineResizing]);

  return {
    timelineHeight,
    isTimelineResizing,
    isLeftRailResizing,
    leftRailWidth,
    isInspectorResizing,
    inspectorWidth,
    boundedInspectorWidth,
    isLeftRailCollapsed,
    isInspectorCollapsed,
    activeRightSidebarSection,
    isRightSidebarPanelOpen,
    activeLeftTab,
    isChatScrollbarVisible,
    assets,
    assetUploadInputRef,
    setActiveLeftTab,
    handleRightSidebarSectionClick,
    handleChatScroll,
    handleAssetUpload,
    handleInspectorResizeStart,
    handleLeftRailResizeStart,
    handleTimelineResizeStart,
    toggleLeftRail,
    toggleInspector,
  };
}



