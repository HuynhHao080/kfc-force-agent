import { z } from "zod";
import type { ToolDefinition } from "@/lib/aws/bedrock";

/**
 * Tools the model may call. They only read, or *propose* a cart change that
 * the customer must confirm with the UI button; nothing the model calls can
 * mutate a cart, place an order or take payment.
 */
export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "search_menu",
    description:
      "Tìm món đang bán trong thực đơn KFC Việt Nam. Hiểu không dấu, viết tắt, sai chính tả, tên gọi khác (bơ gơ, fries) và cỡ (vừa/lớn/đại/lon). " +
      "Có thể gọi nhiều lần. Để duyệt theo ngân sách, để query rỗng và đặt max_price; để xem cả một nhóm (ví dụ đồ uống), đặt category. " +
      "Kết quả là dữ liệu đáng tin duy nhất về món, giá và tình trạng; món không có trong kết quả thì coi như KFC không bán.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Tên món, loại món hoặc nhóm (ví dụ: 'combo nhóm', 'gà rán', 'pepsi'). Rỗng để duyệt toàn bộ." },
        category: { type: "string", description: "Tên nhóm món đúng như trường categories trong kết quả (ví dụ 'Thức Uống & Tráng Miệng')." },
        max_price: { type: "integer", minimum: 0, description: "Giá tối đa mỗi món, VND." },
        min_price: { type: "integer", minimum: 0, description: "Giá tối thiểu mỗi món, VND." },
        sort: { type: "string", enum: ["price_asc", "price_desc"] },
        limit: { type: "integer", minimum: 1, maximum: 8 },
      },
    },
  },
  {
    name: "view_cart",
    description: "Xem giỏ hàng hiện tại của khách: từng dòng món, số lượng, giá và tổng tiền.",
    input_schema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "official_info",
    description:
      "Thông tin chính thức của KFC Việt Nam mà thực đơn không có: bảng thành phần dị ứng, hệ thống nhà hàng (địa chỉ, giờ mở cửa). Trả về đường dẫn chính thức để khách tự xem.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["topic"],
      properties: { topic: { type: "string", enum: ["allergens", "restaurants", "opening_hours"] } },
    },
  },
  {
    name: "propose_cart_change",
    description:
      "Đề xuất thay đổi giỏ hàng. Chỉ là ĐỀ XUẤT: khách phải bấm nút “Xác nhận thao tác” thì mới thực hiện. " +
      "item_id phải lấy từ kết quả search_menu hoặc view_cart. add = thêm số lượng; set_quantity = đặt số lượng cuối cùng; remove = bỏ cả dòng; clear = xoá toàn bộ giỏ (chỉ khi khách nói rõ).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["changes"],
      properties: {
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action"],
            properties: {
              action: { type: "string", enum: ["add", "set_quantity", "remove", "clear"] },
              item_id: { type: "string" },
              quantity: { type: "integer", minimum: 1, maximum: 100 },
            },
          },
        },
      },
    },
  },
];

export const searchInputSchema = z.object({
  query: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  max_price: z.number().int().min(0).max(100_000_000).optional(),
  min_price: z.number().int().min(0).max(100_000_000).optional(),
  sort: z.enum(["price_asc", "price_desc"]).optional(),
  limit: z.number().int().min(1).max(8).optional(),
}).strict();

export const changeSchema = z.object({
  action: z.enum(["add", "set_quantity", "remove", "clear"]),
  item_id: z.string().min(1).max(160).optional(),
  quantity: z.number().int().min(1).max(100).optional(),
}).strict().superRefine((change, ctx) => {
  if (change.action !== "clear" && !change.item_id) ctx.addIssue({ code: "custom", message: "item_id is required" });
  if ((change.action === "add" || change.action === "set_quantity") && change.quantity === undefined)
    ctx.addIssue({ code: "custom", message: "quantity is required" });
});
export const proposeInputSchema = z.object({ changes: z.array(changeSchema).min(1).max(5) }).strict();
export const officialInputSchema = z.object({ topic: z.enum(["allergens", "restaurants", "opening_hours"]) }).strict();
export type OfficialTopic = z.infer<typeof officialInputSchema>["topic"];

export type SearchInput = z.infer<typeof searchInputSchema>;
export type CartChange = z.infer<typeof changeSchema>;

export interface MenuHit { id: string; name: string; price: number; category?: string; description?: string }
export interface SearchResult { items: MenuHit[]; totalMatches: number; notOnMenu: string[]; soldOut: string[] }
export interface CartResult { lines: { item_id: string; name: string; quantity: number; unit_price: number; subtotal: number }[]; total: number }
export interface ProposalResult { status: "awaiting_customer_confirmation" | "blocked"; summary: string[]; blocked: string[] }

/** Capabilities bound to one customer and session by agent-core. */
export interface ToolAgentDeps {
  searchMenu(input: SearchInput): Promise<SearchResult>;
  viewCart(): Promise<CartResult>;
  proposeChanges(changes: CartChange[]): Promise<ProposalResult>;
  officialInfo(topic: OfficialTopic): { topic: OfficialTopic; url: string; note: string };
  /** Every catalog item with its current price and availability, for the fact check. */
  catalog(): Promise<{ id: string; name: string; price: number; available: boolean; category?: string }[]>;
}
