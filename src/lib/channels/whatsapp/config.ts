/**
 * Cấu hình WhatsApp Cloud API, chỉ đọc từ biến môi trường phía server.
 * Không ghi log giá trị nào ở đây. Thiếu cấu hình thì các cổng từ chối (fail closed).
 */
export interface WhatsAppConfig {
  verifyToken?: string;
  appSecret?: string;
  accessToken?: string;
  phoneNumberId?: string;
  graphVersion?: string;
  queueDriver: "local" | "sqs";
}

const value = (raw: string | undefined) => raw?.trim() || undefined;

export function readWhatsAppConfig(env: Record<string, string | undefined> = process.env): WhatsAppConfig {
  return {
    verifyToken: value(env.WHATSAPP_VERIFY_TOKEN),
    appSecret: value(env.WHATSAPP_APP_SECRET),
    accessToken: value(env.WHATSAPP_ACCESS_TOKEN),
    phoneNumberId: value(env.WHATSAPP_PHONE_NUMBER_ID),
    graphVersion: value(env.WHATSAPP_GRAPH_VERSION),
    queueDriver: value(env.CHANNEL_QUEUE_DRIVER)?.toLowerCase() === "sqs" ? "sqs" : "local",
  };
}
