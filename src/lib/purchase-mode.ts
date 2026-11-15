export function kfcPurchaseAssistantEnabled(): boolean {
  return process.env.KFC_PURCHASE_ASSISTANT === "1";
}
