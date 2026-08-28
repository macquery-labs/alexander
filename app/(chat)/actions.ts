"use server";

import { generateText, type UIMessage } from "ai";
import { auth } from "@/app/(auth)/auth";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { titlePrompt } from "@/lib/ai/prompts";
import { getProviderOptions, resolveLanguageModel } from "@/lib/ai/providers";
import type { ModelRole, ModelSettings } from "@/lib/ai/roles";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  getModelSettingsByUserId,
  saveModelSettingsByUserId,
  updateChatVisibilityById,
} from "@/lib/db/queries";
import { getTextFromMessage } from "@/lib/utils";

export async function saveModelSettings(settings: ModelSettings) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await saveModelSettingsByUserId({ settings, userId: session.user.id });
}

/**
 * Persists just the composer's model choice, leaving the other roles alone.
 * Called fire-and-forget from the picker, so it reports failure rather than
 * throwing: not recording a preference must not break choosing a model.
 */
export async function saveRoleModel(
  role: ModelRole,
  modelId: string
): Promise<{ saved: boolean }> {
  const session = await auth();

  if (!session?.user?.id) {
    return { saved: false };
  }

  try {
    const settings = await getModelSettingsByUserId(session.user.id);

    await saveModelSettingsByUserId({
      settings: { ...settings, [role]: modelId },
      userId: session.user.id,
    });

    return { saved: true };
  } catch (error) {
    console.error("Could not save model choice", role, modelId, error);

    return { saved: false };
  }
}

export async function generateTitleFromUserMessage({
  message,
  modelId,
}: {
  message: UIMessage;
  modelId: string;
}) {
  const { text } = await generateText({
    instructions: titlePrompt,
    model: resolveLanguageModel(modelId),
    prompt: getTextFromMessage(message),
    providerOptions: getProviderOptions(modelId) ?? {},
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [message] = await getMessageById({ id });
  if (!message) {
    throw new Error("Message not found");
  }

  const chat = await getChatById({ id: message.chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || chat.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await updateChatVisibilityById({ chatId, visibility });
}
