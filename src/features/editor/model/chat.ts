export type ChatRole = "user" | "assistant";

export type ChatWorkflowStatus = "idle" | "planning" | "applying";

export type ChatWorkflowStepStatus = "pending" | "active" | "done";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string | null;
};

export type ChatWorkflowStep = {
  id: string;
  label: string;
  status: ChatWorkflowStepStatus;
};
