import { BaseLLMProvider, LLMResult } from "./llm-provider";
import { AgentResponse, ProposedAction, ConversationTurn } from "@/lib/types/agent";
import { normalizeVietnamese } from "@/lib/services/menu-service";

/**
 * Deterministic, offline LLM provider.
 *
 * It performs keyword intent detection over the customer's latest message and
 * emits a structured AgentResponse. It never mutates state: it only proposes
 * actions, exactly like the Bedrock provider does.
 */
export class MockLLMProvider extends BaseLLMProvider {
  async generateResponse(
    _systemPrompt: string,
    userPrompt: string,
    conversationHistory?: ConversationTurn[],
  ): Promise<LLMResult> {
    try {
      const currentMessage = extractCurrentMessage(userPrompt);
      const response = this.generateMockResponse(currentMessage, conversationHistory);
      return { success: true, response: this.validateAgentResponse(response) };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Mock LLM provider error",
          type: "mock_error",
        },
      };
    }
  }

  private generateMockResponse(
    message: string,
    conversationHistory?: ConversationTurn[],
  ): AgentResponse {
    const text = normalizeVietnamese(message);

    if (isConfirmation(text)) {
      // Confirmation resumes the mutation proposed in the previous turn.
      const pending = findPendingMutation(conversationHistory);
      if (pending) {
        return buildResponse(
          "Vâng, mình thực hiện thao tác bạn vừa yêu cầu nhé.",
          pending.actionType,
          pending.spec,
        );
      }
      return buildResponse(
        "Mình chưa có thao tác nào đang chờ xác nhận. Bạn muốn làm gì tiếp theo?",
        "SEARCH_MENU",
      );
    }

    const quantity = extractQuantity(text);

    if (mentionsAddToCart(text)) {
      const query = extractItemQuery(text);
      return buildResponse(
        query
          ? `Mình sẽ thêm ${quantity} "${query}" vào giỏ hàng. Bạn xác nhận giúp mình nhé?`
          : "Bạn muốn thêm món nào vào giỏ hàng?",
        "ADD_TO_CART",
        { query, quantity },
      );
    }

    if (mentionsRemoveFromCart(text)) {
      return buildResponse("Bạn muốn xoá món nào khỏi giỏ hàng?", "REMOVE_FROM_CART", {
        query: extractItemQuery(text),
      });
    }

    if (mentionsClearCart(text)) {
      return buildResponse("Bạn có chắc muốn xoá toàn bộ giỏ hàng không?", "CLEAR_CART");
    }

    if (mentionsCart(text)) {
      return buildResponse("Đây là giỏ hàng hiện tại của bạn.", "VIEW_CART");
    }

    if (mentionsMenu(text)) {
      const query = extractItemQuery(text);
      return buildResponse(
        query ? `Mình tìm các món "${query}" trong thực đơn nhé.` : "Đây là thực đơn của KFC.",
        "SEARCH_MENU",
        { query },
      );
    }

    // Default: greeting / unknown intent. Never claims any state change.
    return buildResponse(
      "Xin chào! Mình là trợ lý đặt món KFC. Bạn có thể hỏi về thực đơn, " +
        "xem giỏ hàng, hoặc nói ví dụ: “Thêm 2 combo gà cay vào giỏ hàng”.",
      "SEARCH_MENU",
    );
  }
}

type MockActionType =
  | "SEARCH_MENU"
  | "VIEW_CART"
  | "ADD_TO_CART"
  | "REMOVE_FROM_CART"
  | "CLEAR_CART"
  | "CONFIRMATION"
  | "UNKNOWN";

interface MockActionSpec {
  query?: string;
  quantity?: number;
}

function buildResponse(
  message: string,
  actionType: MockActionType,
  spec: MockActionSpec = {},
): AgentResponse {
  const parameters: Record<string, unknown> = {};
  if (spec.query) parameters.query = spec.query;
  if (spec.quantity !== undefined) parameters.quantity = spec.quantity;

  const mutating =
    actionType === "ADD_TO_CART" ||
    actionType === "REMOVE_FROM_CART" ||
    actionType === "CLEAR_CART";

  // "CONFIRMATION" is an intent label, not an executable action: it proposes
  // no tool call at all, so a bare "Xác nhận" cannot trigger a mutation.
  const proposedType: ProposedAction["type"] =
    actionType === "CONFIRMATION" ? "UNKNOWN" : actionType;

  const action: ProposedAction = {
    id: `action_${actionType.toLowerCase()}`,
    type: proposedType,
    parameters,
    requiresConfirmation: mutating,
  };

  return {
    message,
    intent: actionType,
    confidence: 0.8,
    actions: [action],
    requiresConfirmation: mutating,
  };
}

/** Pulls the latest customer line out of the assembled prompt. */
export function extractCurrentMessage(userPrompt: string): string {
  const marker = "Khách hàng:";
  const lastIndex = userPrompt.lastIndexOf(marker);
  if (lastIndex === -1) return userPrompt.trim();
  const lines = userPrompt
    .slice(lastIndex + marker.length)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines[0] ?? "";
}

function isConfirmation(text: string): boolean {
  return ["xac nhan", "dong y", "dung roi", "ok", "okay", "yes", "chuan"].some(
    (token) => text === token || text.startsWith(`${token} `) || text.startsWith(`${token}!`),
  );
}

function mentionsAddToCart(text: string): boolean {
  return (
    (text.includes("them") || text.includes("add")) &&
    (text.includes("gio") || text.includes("cart"))
  );
}

function mentionsRemoveFromCart(text: string): boolean {
  return (
    (text.includes("xoa") || text.includes("remove")) && text.includes("gio")
  );
}

function mentionsClearCart(text: string): boolean {
  return text.includes("toan bo") && text.includes("gio");
}

function mentionsCart(text: string): boolean {
  return text.includes("gio hang") || text.includes("cart") || text.includes("bao nhieu tien");
}

function mentionsMenu(text: string): boolean {
  return [
    "menu",
    "thuc don",
    "mon",
    "ga",
    "combo",
    "burger",
    "khoai",
    "pepsi",
    "nuoc",
    " co gi",
  ].some((token) => text.includes(token));
}

function extractQuantity(text: string): number {
  const match = text.match(/\b(\d{1,6})\b/);
  if (!match) return 1;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Strips command words so what remains is the product phrase to search for. */
function extractItemQuery(text: string): string {
  const stopWords = [
    "them",
    "cho",
    "minh",
    "vao",
    "gio",
    "hang",
    "cart",
    "toi",
    "muon",
    "xem",
    "cac",
    "mon",
    "co",
    "khong",
    "bao",
    "nhieu",
    "tien",
    "tim",
    "kiem",
    "giup",
    "nhe",
    "add",
    "remove",
    "xoa",
    "co",
  ];
  const kept = text
    .split(" ")
    .filter((word) => word.length > 0 && !stopWords.includes(word) && !/^\d+$/.test(word));
  return kept.join(" ").trim();
}

