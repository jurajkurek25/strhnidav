"use client";

import { useRouter } from "next/navigation";
import { TaskSubmissionForm } from "@/components/TaskSubmissionForm";
import type { TaskType } from "@/lib/db/schema";

export function TaskSubmissionSection(props: {
  lessonId: string;
  taskType: TaskType;
  taskPrompt: string | null;
  initialSubmission: { status: "pending" | "approved" | "rejected"; ai_feedback: string | null } | null;
}) {
  const router = useRouter();
  return <TaskSubmissionForm {...props} onApproved={() => router.refresh()} />;
}
