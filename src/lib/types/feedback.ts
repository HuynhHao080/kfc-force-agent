export interface OrderFeedback {
  rating: number;
  comment: string;
  revision: string;
  createdAt: string;
  updatedAt: string;
  reply?: { message: string; createdAt: string };
}
export interface FeedbackView { eligible: boolean; feedback: OrderFeedback | null }
export interface FeedbackInbox {
  sampleLimit: number;
  sampledFeedbacks: number;
  matchedFeedbacks: number;
  unanswered: number;
  averageRating: number | null;
  entries: { orderId: string; fulfillment: "pickup" | "delivery" | null; feedback: OrderFeedback }[];
}
