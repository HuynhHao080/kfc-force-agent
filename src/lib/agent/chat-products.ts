import type { ActionExecutionResult } from "@/lib/types/agent";
import type { MenuItem } from "@/lib/types/menu";
import type { Message } from "@/lib/types/session";
import type { ChatProduct } from "@/lib/types/chat-product";

export function chatProducts(ids: string[], menu: MenuItem[]): ChatProduct[] {
  const current = new Map(
    menu
      .filter((item) => item.isActive && item.isAvailable)
      .map((item) => [item.id, item]),
  );
  return [...new Set(ids)].slice(0, 6).flatMap((id) => {
    const item = current.get(id);
    return item
      ? [
          {
            id: item.id,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
          },
        ]
      : [];
  });
}

export function resultProductIds(execution: ActionExecutionResult[]): string[] {
  const ids: string[] = [];
  for (const result of execution) {
    if (
      !result.executed ||
      !["LIST_MENU", "SEARCH_MENU", "GET_MENU_ITEM"].includes(
        result.actionType,
      ) ||
      !result.data ||
      typeof result.data !== "object"
    )
      continue;
    const data = result.data as { items?: unknown[]; item?: unknown };
    for (const item of [
      ...(Array.isArray(data.items) ? data.items : []),
      data.item,
    ]) {
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        typeof item.id === "string"
      )
        ids.push(item.id);
    }
  }
  return [...new Set(ids)].slice(0, 6);
}

export function hydrateChatMessages(messages: Message[], menu: MenuItem[]) {
  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      ...message,
      products:
        message.role === "assistant"
          ? chatProducts(message.productIds ?? [], menu)
          : undefined,
    }));
}
