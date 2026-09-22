import { ChatRequest, ChatResponse } from "@/lib/types/domain";

export async function processChat(request: ChatRequest): Promise<ChatResponse> {
  const reply = await getMockAgentResponse(request.message);
  return {
    reply,
    sessionId: request.sessionId,
    action: undefined,
  };
}

async function getMockAgentResponse(message: string): Promise<string> {
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes("xin chào") ||
    normalized.includes("chào") ||
    normalized.includes("hello") ||
    normalized.includes("hi")
  ) {
    return "Xin chào! Mình có thể giúp bạn đặt món KFC 🍗 Bạn muốn gọi món gì?";
  }

  if (normalized.includes("menu") || normalized.includes("thực đơn")) {
    return "Dưới đây là thực đơn KFC hiện có:\n\n🍗 Combo Gà Rán – 149,000đ\n🌶️ Combo Gà Cay – 159,000đ\n🍔 Burger Gà – 89,000đ\n🥤 Pepsi – 25,000đ\n🥤 Coca-Cola – 25,000đ\n\nBạn muốn gọi món gì?";
  }

  if (normalized.includes("voucher") || normalized.includes("giảm giá")) {
    return "Hiện tại có voucher giảm giá 10% cho đơn hàng từ 200,000đ. Bạn có muốn sử dụng không?";
  }

  if (normalized.includes("xác nhận") || normalized.includes("confirm")) {
    return "Bạn đã xác nhận đơn hàng. Cảm ơn bạn đã đặt hàng! 🎉 Đơn sẽ được chuẩn bị sớm.";
  }

  if (normalized.includes("địa chỉ") || normalized.includes("address")) {
    return "Bạn muốn giao đến địa chỉ nhà mình. Vui lòng xác nhận địa chỉ giao hàng.";
  }

  if (normalized.includes("thanh toán") || normalized.includes("payment")) {
    return "Vui lòng xác nhận đơn hàng trước khi thanh toán.";
  }

  if (normalized.includes("bỏ") || normalized.includes("remove") || normalized.includes("xoá")) {
    return "Đã bỏ món khỏi giỏ hàng.";
  }

  return `Mình đã nhận: "${message}". Mình đang xử lý yêu cầu của bạn. Bạn có thể nói "menu" để xem thực đơn hoặc "xác nhận" để xác nhận đơn hàng.`;
}
