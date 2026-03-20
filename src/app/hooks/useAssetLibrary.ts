import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";

import { createAssetItem } from "../editor-asset-utils";
import { AssetItem } from "../editor-types";

const revokePreviewUrl = (asset: AssetItem) => {
  if (asset.previewUrl) {
    URL.revokeObjectURL(asset.previewUrl);
  }
};

export const useAssetLibrary = () => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const assetsRef = useRef<AssetItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    return () => {
      assetsRef.current.forEach(revokePreviewUrl);
    };
  }, []);

  const appendFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const nextAssets = await Promise.all(Array.from(files).map(createAssetItem));
    setAssets((currentAssets) => [...currentAssets, ...nextAssets]);
  }, []);

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    void appendFiles(event.target.files);
    event.target.value = "";
  }, [appendFiles]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    void appendFiles(event.dataTransfer.files);
  }, [appendFiles]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  return {
    assets,
    fileInputRef,
    isDragOver,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileInputChange,
  };
};
