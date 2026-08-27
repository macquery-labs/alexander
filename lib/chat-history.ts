import type { Chat } from "@/lib/db/schema";

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

export const CHAT_HISTORY_PAGE_SIZE = 20;

/**
 * SWR infinite key builder for the chat history list.
 *
 * Kept out of `components/chat/sidebar-history.tsx` so that hooks and other
 * components can reach it without importing the component that renders the
 * list — that import direction used to form a cycle.
 */
export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory | null
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (pageIndex === 0) {
    return `${base}/api/history?limit=${CHAT_HISTORY_PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData?.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${base}/api/history?ending_before=${firstChatFromPage.id}&limit=${CHAT_HISTORY_PAGE_SIZE}`;
}
