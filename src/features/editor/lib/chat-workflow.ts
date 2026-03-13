import { ChatMessage, ChatRole, ChatWorkflowStatus, ChatWorkflowStep, ChatWorkflowStepStatus } from "../model/chat";

export function createChatMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content: "Describe the edit you want. I can generate an updated edit schema for the current timeline and apply it to the preview.",
    createdAt: null,
  },
];

export function buildWorkflowSteps(status: ChatWorkflowStatus): ChatWorkflowStep[] {
  const getStepStatus = (current: "planning" | "applying"): ChatWorkflowStepStatus => {
    if (status === "idle") {
      return "pending";
    }

    const order = ["planning", "applying"] as const;
    const currentIndex = order.indexOf(current);
    const activeIndex = order.indexOf(status);

    if (currentIndex < activeIndex) {
      return "done";
    }

    if (currentIndex === activeIndex) {
      return "active";
    }

    return "pending";
  };

  return [
    {
      id: "planning",
      label: "Building edit plan",
      status: getStepStatus("planning"),
    },
    {
      id: "applying",
      label: "Applying timeline updates",
      status: getStepStatus("applying"),
    },
  ];
}

export function isSchemaGenerationRequest(prompt: string) {
  const token = prompt.trim().toLowerCase();
  return (
    token.startsWith("/schema ")
    || token === "generate schema"
    || token === "now generate it"
    || token === "generate it"
    || token.includes("сгенерируй схему")
  );
}

export function shouldUseEditWorkflow(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("/schema ")) {
    return false;
  }

  const editKeywords = [
    "add",
    "remove",
    "change",
    "edit",
    "create",
    "make",
    "insert",
    "trim",
    "cut",
    "caption",
    "subtitle",
    "transition",
    "animate",
    "montage",
    "overlay",
    "text",
    "zoom",
    "scene",
    "track",
    "добав",
    "убер",
    "измени",
    "сделай",
    "создай",
    "обреж",
    "выреж",
    "переход",
    "анимац",
    "монтаж",
    "текст",
    "сцена",
    "дорож",
    "зум",
  ];

  return editKeywords.some((keyword) => normalized.includes(keyword));
}
