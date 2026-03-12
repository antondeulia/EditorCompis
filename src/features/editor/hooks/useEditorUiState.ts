"use client";

import { ChangeEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { defaultSidebarWidth, defaultTimelineHeight, RightSidebarSection } from "../model/constants";
import { AssetItem, AssetKind } from "../model/types";
import { clamp, formatFileSize } from "../lib/utils";
import { extractMediaMetadata } from "../lib/media-metadata";
import { uploadEditorAsset } from "../services/media-upload-gateway";

type UseEditorUiStateParams = {
  initialAssets: AssetItem[];
};

function resolveAssetKindFromMimeType(mimeType: string): AssetKind {
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return "other";
}

function resolveMediaLabel(kind: AssetKind) {
  if (kind === "video") {
    return "Video";
  }

  if (kind === "image") {
    return "Photo";
  }

  if (kind === "audio") {
    return "Audio";
  }

  return "File";
}

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

  const handleAssetUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const nextAssets = await Promise.all(Array.from(files).map(async (file, index): Promise<AssetItem> => {
      const src = URL.createObjectURL(file);
      const localKind = resolveAssetKindFromMimeType(file.type);
      const localMetadata = await extractMediaMetadata(file, src);
      const localAsset: AssetItem = {
        id: `${Date.now()}-${index}-${file.name}`,
        name: file.name,
        kind: localKind,
        src,
        source: "local",
        mimeType: file.type,
        durationInSeconds: localMetadata.durationInSeconds,
        width: localMetadata.width,
        height: localMetadata.height,
        revokeOnDispose: true,
        sizeLabel: formatFileSize(file.size),
        mediaLabel: resolveMediaLabel(localKind),
      };

      try {
        const uploaded = await uploadEditorAsset(file);
        const serverMetadata = await extractMediaMetadata(file, uploaded.src);

        URL.revokeObjectURL(src);

        return {
          id: uploaded.id,
          name: uploaded.name,
          kind: uploaded.kind,
          src: uploaded.src,
          source: "server",
          mimeType: uploaded.mimeType,
          durationInSeconds: serverMetadata.durationInSeconds ?? localMetadata.durationInSeconds,
          width: serverMetadata.width ?? localMetadata.width,
          height: serverMetadata.height ?? localMetadata.height,
          revokeOnDispose: false,
          sizeLabel: formatFileSize(uploaded.sizeBytes),
          mediaLabel: resolveMediaLabel(uploaded.kind),
        };
      } catch {
        return localAsset;
      }
    }));

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



