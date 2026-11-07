import { randomUUID } from "node:crypto";
import type { OrderRepository } from "@/lib/db/repositories/interfaces/order-repository.interface";
import { DomainError } from "@/lib/domain-error";
import { customerFeedbackSchema, feedbackReplySchema, feedbackFiltersSchema } from "@/lib/validation/feedback";
import type { FeedbackInbox, FeedbackView, OrderFeedback } from "@/lib/types/feedback";
import type { z } from "zod";

export class FeedbackService {
  constructor(private orders: OrderRepository) {}
  private async owned(userId: string, orderId: string) {
    const order = await this.orders.getOrderById(orderId);
    if (!order || order.userId !== userId) throw new DomainError("ORDER_NOT_FOUND", "Không tìm thấy đơn hàng.", 404);
    return order;
  }
  async view(userId: string, orderId: string): Promise<FeedbackView> {
    const order = await this.owned(userId, orderId);
    return { eligible: order.status === "COMPLETED", feedback: order.feedback ?? null };
  }
  async save(userId: string, input: z.infer<typeof customerFeedbackSchema>): Promise<OrderFeedback> {
    const fields = customerFeedbackSchema.parse(input);
    const order = await this.owned(userId, fields.orderId), current = order.feedback;
    if (order.status !== "COMPLETED") throw new DomainError("FEEDBACK_NOT_READY", "Chỉ đánh giá đơn đã hoàn tất.", 409);
    if (current?.rating === fields.rating && current.comment === fields.comment) return current;
    if (current?.reply) throw new DomainError("FEEDBACK_LOCKED", "Cửa hàng đã phản hồi. Đánh giá được giữ nguyên để bảo toàn nội dung trao đổi.", 409);
    if ((current?.revision ?? undefined) !== fields.revision)
      throw new DomainError("FEEDBACK_CHANGED", "Đánh giá đã thay đổi. Hãy tải lại trước khi lưu.", 409);
    const now = new Date().toISOString();
    const next: OrderFeedback = { rating: fields.rating, comment: fields.comment, revision: randomUUID(), createdAt: current?.createdAt ?? now, updatedAt: now };
    await this.orders.saveFeedback(order.id, userId, next, current?.revision ?? null);
    return next;
  }
  async reply(input: z.infer<typeof feedbackReplySchema>): Promise<OrderFeedback> {
    const fields = feedbackReplySchema.parse(input), order = await this.orders.getOrderById(fields.orderId), current = order?.feedback;
    if (!order || !current) throw new DomainError("FEEDBACK_NOT_FOUND", "Chưa có đánh giá của đơn này.", 404);
    if (current.reply) {
      if (current.reply.message === fields.message) return current;
      throw new DomainError("FEEDBACK_REPLIED", "Đã có phản hồi cho đánh giá này. Không ghi đè nội dung đã gửi.", 409);
    }
    if (current.revision !== fields.revision) throw new DomainError("FEEDBACK_CHANGED", "Khách đã cập nhật đánh giá. Hãy tải lại trước khi trả lời.", 409);
    const now = new Date().toISOString();
    const next = { ...current, revision: randomUUID(), updatedAt: now, reply: { message: fields.message, createdAt: now } };
    await this.orders.saveFeedback(order.id, order.userId, next, current.revision);
    return next;
  }
  async inbox(filters: z.infer<typeof feedbackFiltersSchema>): Promise<FeedbackInbox> {
    const source = await this.orders.getRecentFeedback(200);
    const entries = source.filter(order => order.feedback && (filters.rating === "all" || order.feedback.rating === Number(filters.rating)) &&
      (filters.response === "all" || (filters.response === "replied") === !!order.feedback.reply))
      .map(order => ({ orderId: order.id, fulfillment: order.fulfillment ?? null, feedback: order.feedback! }));
    return { sampleLimit: 200, sampledFeedbacks: source.length, matchedFeedbacks: entries.length,
      unanswered: entries.filter(entry => !entry.feedback.reply).length,
      averageRating: entries.length ? entries.reduce((sum, entry) => sum + entry.feedback.rating, 0) / entries.length : null, entries };
  }
}
