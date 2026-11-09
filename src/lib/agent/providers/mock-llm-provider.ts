import { BaseLLMProvider, LLMResult } from "./llm-provider";
import { AgentResponse, ProposedAction } from "@/lib/types/agent";
import { prepareMockMessage, restoreMockSizes } from "./mock-message";

/** Offline intent parser. Only proposes actions; policy and tools execute them. */
export class MockLLMProvider extends BaseLLMProvider {
  async generateResponse(
    _systemPrompt: string,
    userPrompt: string,
  ): Promise<LLMResult> {
    try {
      return {
        success: true,
        response: this.validateAgentResponse(
          parseMessage(extractCurrentMessage(userPrompt)),
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Mock provider error",
          type: "mock_error",
        },
      };
    }
  }
}

function parseMessage(message: string): AgentResponse {
  const prepared = prepareMockMessage(message);
  const { text, quantity } = prepared;
  if (/^(?:xac nhan|dong y|ok|okay|yes|dung roi|chuan)(?: |$)/.test(text)) {
    return response(
      "Hãy dùng nút “Xác nhận thao tác” ở đề xuất bạn vừa xem. Nếu chưa có đề xuất, bạn hãy chọn món trước nhé.",
    );
  }
  const clear =
    /^(?:(?:xoa|bo|don|clear)(?: (?:toan bo|tat ca|het)(?: (?:cac )?mon)?(?: (?:trong|khoi))?)? (?:gio(?: hang)?|cart)(?: cua (?:toi|minh|em))?|lam (?:trong|rong) (?:gio(?: hang)?|cart))$/.test(
      text,
    );
  const relativeEdit = /^(?:tang|giam)\b/.test(text);
  if (relativeEdit && !/\b(?:len|con|xuong)\b/.test(text))
    return response(
      "Bạn muốn thay đổi tương đối hay đổi thành số lượng cụ thể? Để đặt số lượng cuối cùng, hãy nói ví dụ: “Giảm Pepsi còn 2” hoặc “Tăng Pepsi lên 3”.",
    );
  const update = /^(?:doi|sua|cap nhat|update)\b/.test(text) || relativeEdit;
  const remove =
    /^(?:xoa|bo|remove|huy)\b/.test(text) && !/^huy don\b/.test(text);
  const add =
    /^(?:them|add|lay|goi|mua)\b/.test(text) ||
    (/^(?:cho (?:minh|toi|em)|(?:minh|toi|em) (?:muon|can|lay))\b/.test(text) &&
      !/\b(?:xem|tim|menu|thuc don)\b/.test(text));
  if (
    (clear || update || remove || add) &&
    /\b(?:khong|dung|chua)\b/.test(text)
  ) {
    return response(
      "Mình chưa thay đổi giỏ hàng. Khi muốn đặt món, bạn có thể gửi yêu cầu mới.",
    );
  }
  // Also catch negated commands before intent detection; never turn a refusal
  // such as 'Đừng thêm...' into an executable proposal.
  if (/^(?:khong|dung|chua)\b/.test(text))
    return response("Mình giữ nguyên giỏ hàng nhé.");
  if (
    ((clear || update || remove || add) && !clear && prepared.ambiguous) ||
    (prepared.multiple &&
      /\b(?:them|add|lay|goi|mua|xoa|bo|remove|huy|doi|sua|tang|giam|don|clear|lam)\b/.test(
        text,
      ))
  )
    return response(
      "Mình chưa thay đổi giỏ. Hãy gửi một món và một số lượng nguyên rõ ràng mỗi lần; ví dụ “Thêm hai Pepsi” hoặc “Đổi Pepsi thành ba”.",
    );
  if (/^huy don\b/.test(text))
    return response(
      "Bạn hãy mở Đơn của tôi, chọn đúng đơn và dùng nút huỷ nếu trạng thái còn cho phép.",
    );
  const query = restoreMockSizes(
    extractItemQuery(prepared.queryText),
    prepared.sizes,
  );
  if (clear)
    return response(
      "Bạn muốn xoá toàn bộ giỏ hàng. Hãy xem lại đề xuất trước khi xác nhận.",
      "CLEAR_CART",
    );
  if (update) {
    if (quantity === undefined)
      return response(
        "Bạn muốn đổi thành bao nhiêu phần? Ví dụ: “Đổi Pepsi thành 3”.",
      );
    return response(
      "Mình đã chuẩn bị đề xuất đổi số lượng. Hãy xem lại trước khi xác nhận.",
      "UPDATE_CART",
      { query, quantity },
    );
  }
  if (remove && quantity !== undefined)
    return response(
      "Bạn muốn xoá cả món hay giảm số lượng? Để đổi số lượng, hãy nói ví dụ: “Đổi Pepsi thành 2”.",
    );
  if (remove)
    return response(
      "Mình đã chuẩn bị đề xuất xoá món. Hãy xem lại trước khi xác nhận.",
      "REMOVE_FROM_CART",
      { query },
    );
  if (add) {
    if (!query)
      return response(
        "Bạn muốn thêm món nào? Ví dụ: “Cho mình 2 combo gà cay”.",
      );
    return response(
      "Mình đã chuẩn bị đề xuất thêm món. Hãy xem lại trước khi xác nhận.",
      "ADD_TO_CART",
      { query, quantity: quantity ?? 1 },
    );
  }
  if (/\b(?:gio hang|cart|bao nhieu tien|kiem tra tien trong gio)\b/.test(text))
    return response("Đây là giỏ hàng hiện tại của bạn.", "VIEW_CART");
  if (/\b(?:menu|thuc don|mon|ga|combo|burger|khoai|pepsi|nuoc)\b/.test(text)) {
    return response(
      query
        ? `Mình tìm món phù hợp với “${query}” nhé.`
        : "Đây là thực đơn hiện tại.",
      "SEARCH_MENU",
      { query },
    );
  }
  return response(
    "Chào bạn! Bạn có thể xem thực đơn, nói “Cho mình 2 combo gà cay”, “Đổi Pepsi thành 3” hoặc “Xoá Pepsi khỏi giỏ hàng”.",
  );
}

function response(
  message: string,
  type?: ProposedAction["type"],
  parameters: Record<string, unknown> = {},
): AgentResponse {
  const mutating =
    type === "ADD_TO_CART" ||
    type === "UPDATE_CART" ||
    type === "REMOVE_FROM_CART" ||
    type === "CLEAR_CART";
  return {
    message,
    intent: type ?? "CONVERSATION",
    confidence: 0.8,
    requiresConfirmation: mutating,
    actions: type
      ? [
          {
            id: `action_${type.toLowerCase()}`,
            type,
            parameters,
            requiresConfirmation: mutating,
          },
        ]
      : [],
  };
}

/** Prefer the final JSON envelope so message newlines/role labels stay data. */
export function extractCurrentMessage(userPrompt: string): string {
  const lastLine = userPrompt.trimEnd().split("\n").at(-1) ?? "";
  const marker = "USER_MESSAGE_JSON:";
  if (lastLine.startsWith(marker)) {
    const message: unknown = JSON.parse(lastLine.slice(marker.length));
    if (typeof message !== "string")
      throw new Error("Invalid current message envelope");
    return message;
  }
  // Compatibility for direct provider callers using the earlier prompt format.
  const index = userPrompt.lastIndexOf("Khách hàng:");
  return index < 0
    ? userPrompt.trim()
    : (userPrompt
        .slice(index + "Khách hàng:".length)
        .split("\n")
        .find((line) => line.trim())
        ?.trim() ?? "");
}

const stopWords = new Set([
  "them",
  "menu",
  "thuc",
  "don",
  "la",
  "gi",
  "cho",
  "minh",
  "toi",
  "em",
  "vao",
  "khoi",
  "gio",
  "hang",
  "cart",
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
  "nha",
  "voi",
  "add",
  "remove",
  "xoa",
  "bo",
  "lay",
  "goi",
  "mua",
  "tang",
  "giam",
  "xuong",
  "doi",
  "sua",
  "cap",
  "nhat",
  "update",
  "so",
  "luong",
  "thanh",
  "len",
  "con",
  "phan",
  "cai",
  "chai",
  "ly",
  "trong",
  "huy",
  "ban",
  "oi",
  "hay",
  "can",
  "toan",
  "tat",
  "ca",
  "het",
]);
function extractItemQuery(text: string): string {
  return text
    .split(" ")
    .filter((word) => word && !stopWords.has(word) && !/^\d+$/.test(word))
    .join(" ")
    .replace(/(\d+)d(\d+)(l|lit)\b/g, "$1 $2$3")
    .trim();
}
