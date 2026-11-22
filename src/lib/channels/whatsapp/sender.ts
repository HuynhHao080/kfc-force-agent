import type { OutboundMessage } from "../types";
import { maskWaId } from "./identity";
import { MAX_TEXT_LENGTH, isWaId } from "./normalize";

/** Giới hạn của tin interactive trên WhatsApp Cloud API. */
export const WHATSAPP_LIMITS = {
  text: MAX_TEXT_LENGTH,
  interactiveBody: 1024,
  buttons: 3,
  buttonTitle: 20,
  replyId: 256,
  listRows: 10,
  listButton: 20,
  rowTitle: 24,
  rowDescription: 72,
} as const;

/** Câu dẫn khi nội dung quá dài để nằm chung với nút; nội dung được gửi trước thành tin chữ. */
const CHOICE_PROMPT = "Bạn chọn một lựa chọn bên dưới nhé.";

type Payload = Record<string, unknown>;
const base = (to: string) => ({ messaging_product: "whatsapp", recipient_type: "individual", to });

/** Chia tin dài theo xuống dòng/khoảng trắng, mỗi phần ≤ max ký tự. */
export function splitText(text: string, max: number = WHATSAPP_LIMITS.text): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const cut = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = cut > max / 2 ? cut : max;
    parts.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

function check(condition: boolean, message: string) {
  if (!condition) throw new RangeError(message);
}

/**
 * OutboundMessage → payload Graph API (/{phone-number-id}/messages). Nút hoặc dòng sai giới hạn là lỗi
 * lập trình nên ném lỗi thay vì cắt ngầm (cắt id nút có thể làm nút xác nhận trỏ sai đề xuất).
 */
export function toGraphPayloads(to: string, message: OutboundMessage): Payload[] {
  check(isWaId(to), "Người nhận không hợp lệ.");
  if (message.kind === "text") {
    const parts = splitText(message.text);
    check(parts.length > 0, "Tin chữ rỗng.");
    return parts.map((body) => ({ ...base(to), type: "text", text: { body, preview_url: false } }));
  }
  const body = message.text.trim();
  check(body.length > 0, "Tin interactive cần nội dung.");
  // Nội dung dài hơn giới hạn của tin interactive: gửi trước thành tin chữ, nút đi kèm câu dẫn ngắn.
  const lead = body.length > WHATSAPP_LIMITS.interactiveBody ? toGraphPayloads(to, { kind: "text", text: body }) : [];
  const interactiveBody = { text: lead.length ? CHOICE_PROMPT : body };
  if (message.kind === "buttons") {
    const { buttons } = message;
    check(buttons.length >= 1 && buttons.length <= WHATSAPP_LIMITS.buttons, "Cần 1–3 nút.");
    check(new Set(buttons.map((button) => button.id)).size === buttons.length, "Id nút bị trùng.");
    for (const button of buttons) {
      check(button.id.length >= 1 && button.id.length <= WHATSAPP_LIMITS.replyId, "Id nút không hợp lệ.");
      check(button.title.trim().length >= 1 && button.title.length <= WHATSAPP_LIMITS.buttonTitle, `Tiêu đề nút quá ${WHATSAPP_LIMITS.buttonTitle} ký tự.`);
    }
    return [...lead, {
      ...base(to), type: "interactive",
      interactive: { type: "button", body: interactiveBody, action: { buttons: buttons.map(({ id, title }) => ({ type: "reply", reply: { id, title } })) } },
    }];
  }
  const { rows, buttonLabel } = message;
  check(rows.length >= 1 && rows.length <= WHATSAPP_LIMITS.listRows, "Cần 1–10 dòng.");
  check(new Set(rows.map((row) => row.id)).size === rows.length, "Id dòng bị trùng.");
  check(buttonLabel.trim().length >= 1 && buttonLabel.length <= WHATSAPP_LIMITS.listButton, "Nhãn nút danh sách không hợp lệ.");
  for (const row of rows) {
    check(row.id.length >= 1 && row.id.length <= WHATSAPP_LIMITS.replyId, "Id dòng không hợp lệ.");
    check(row.title.trim().length >= 1 && row.title.length <= WHATSAPP_LIMITS.rowTitle, `Tiêu đề dòng quá ${WHATSAPP_LIMITS.rowTitle} ký tự.`);
    check((row.description?.length ?? 0) <= WHATSAPP_LIMITS.rowDescription, `Mô tả dòng quá ${WHATSAPP_LIMITS.rowDescription} ký tự.`);
  }
  return [...lead, {
    ...base(to), type: "interactive",
    interactive: {
      type: "list", body: interactiveBody,
      action: { button: buttonLabel, sections: [{ rows: rows.map(({ id, title, description }) => ({ id, title, ...(description ? { description } : {}) })) }] },
    },
  }];
}

export interface SendResult {
  ok: boolean;
  /** HTTP status của lần gọi cuối; 0 nếu lỗi mạng. */
  status: number;
  attempts: number;
  messageIds: string[];
  /** Mã lỗi số của Graph API, nếu có. */
  errorCode?: number;
}

export interface SenderOptions {
  accessToken?: string;
  phoneNumberId?: string;
  graphVersion?: string;
  fetch?: typeof fetch;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface WhatsAppSender {
  send(to: string, message: OutboundMessage): Promise<SendResult>;
}

/**
 * Gửi tin qua Graph API. Thử lại có giới hạn khi 429/5xx hoặc lỗi mạng (lùi 0,5 s, 1 s…);
 * lỗi 4xx khác không thử lại. Lỗi mạng sau khi Meta đã nhận có thể làm khách nhận trùng một tin.
 * Log chỉ có status, mã lỗi số và số đã che; không có token, nội dung tin hay body phản hồi.
 */
export function createWhatsAppSender(options: SenderOptions): WhatsAppSender {
  const { accessToken, phoneNumberId, graphVersion } = options;
  if (!accessToken) throw new Error("Thiếu WHATSAPP_ACCESS_TOKEN.");
  if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) throw new Error("WHATSAPP_PHONE_NUMBER_ID không hợp lệ.");
  if (!graphVersion || !/^v\d{1,3}\.\d{1,3}$/.test(graphVersion)) throw new Error("WHATSAPP_GRAPH_VERSION phải có dạng vNN.N.");
  const doFetch = options.fetch ?? fetch;
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 5);
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? 10_000;
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  async function post(payload: Payload): Promise<SendResult & { messageId?: string }> {
    let status = 0, errorCode: number | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await doFetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });
        status = response.status;
        const data = (await response.json().catch(() => null)) as { messages?: { id?: unknown }[]; error?: { code?: unknown } } | null;
        if (response.ok) {
          const id = data?.messages?.[0]?.id;
          return { ok: true, status, attempts: attempt, messageIds: [], ...(typeof id === "string" ? { messageId: id } : {}) };
        }
        errorCode = typeof data?.error?.code === "number" ? data.error.code : undefined;
        if (status !== 429 && status < 500) return { ok: false, status, attempts: attempt, messageIds: [], errorCode };
      } catch {
        status = 0;
      }
      if (attempt < maxAttempts) await sleep(500 * 2 ** (attempt - 1));
    }
    return { ok: false, status, attempts: maxAttempts, messageIds: [], errorCode };
  }

  return {
    async send(to, message) {
      const payloads = toGraphPayloads(to, message);
      const messageIds: string[] = [];
      let attempts = 0, status = 0;
      for (const payload of payloads) {
        const result = await post(payload);
        attempts += result.attempts;
        status = result.status;
        if (!result.ok) {
          console.error("whatsapp_send_failed", JSON.stringify({ status: result.status, errorCode: result.errorCode ?? null, attempts: result.attempts, to: maskWaId(to) }));
          return { ok: false, status, attempts, messageIds, ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}) };
        }
        if (result.messageId) messageIds.push(result.messageId);
      }
      return { ok: true, status, attempts, messageIds };
    },
  };
}
