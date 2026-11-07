"use client";
export function PrintReceiptButton() {
  return (
    <button
      type="button"
      className="button primary"
      onClick={() => window.print()}
    >
      In / Lưu PDF
    </button>
  );
}
