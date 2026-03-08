export type CreateVideoFlow = "blank" | "template" | "upload";
export type CreateVideoStage = "select-start" | "template-select" | "details";
export type TemplateFilter = "all" | "social" | "marketing" | "podcast";

export type TemplateOption = {
  id: string;
  name: string;
  description: string;
  category: Exclude<TemplateFilter, "all">;
  previewVideoSrc: string;
};
