"use client";
import { officialKfcSources } from "@/lib/catalog/official-sources";
import type { ChatProduct } from "@/lib/types/chat-product";
import { MenuImage } from "@/components/storefront/menu-image";
import { money } from "@/lib/storefront-types";
import { ReadAloud } from "./read-aloud";
interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  products?: ChatProduct[];
  disabled?: boolean;
  onChooseProduct?: (id: string) => void;
  onViewProduct?: (id: string) => void;
}
export function ChatMessage({
  role,
  content,
  products = [],
  disabled,
  onChooseProduct,
  onViewProduct,
}: ChatMessageProps) {
  const visibleContent = role === "assistant" && products.length
    ? content.split("\n").filter(line => !products.some(product => line.startsWith(product.name + ": "))).join("\n")
    : content;
  return (
    <div className={`chat-turn ${role}`}>
      <div className={`chat-message ${role}`}>
        <span className="sr-only">{role === "user" ? "Bạn" : "Trợ lý"}: </span>
        {role === "assistant"
          ? visibleContent
              .split(
                /(https:\/\/kfcvietnam\.com\.vn\/(?:allergen-chart|he-thong-nha-hang-kfc|menu))(?=$|[\s.,!?])/g,
              )
              .map((part, index) =>
                Object.values(officialKfcSources).some(
                  (url) => url === part,
                ) ? (
                  <a
                    key={index}
                    className="text-button"
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {part}
                  </a>
                ) : (
                  part
                ),
              )
          : visibleContent}
      </div>
      {role === "assistant" && products.length > 0 && (
        <div
          className="chat-products"
          role="group"
          aria-label="Món trợ lý tìm được"
        >
          <div className="chat-product-track">
            {products.map((product) => (
              <article className="chat-product" key={product.id}>
                <button
                  className="chat-product-photo"
                  type="button"
                  aria-label={`Xem ${product.name}`}
                  onClick={() => onViewProduct?.(product.id)}
                  disabled={disabled || !onViewProduct}
                >
                  <MenuImage
                    imageUrl={product.imageUrl}
                    alt={product.name}
                    width={100}
                    height={90}
                  />
                </button>
                <div className="chat-product-body">
                  <strong>{product.name}</strong>
                  <span>{money(product.price)}</span>
                  <div className="chat-product-actions">
                    {onChooseProduct && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onChooseProduct(product.id)}
                        aria-label={`Chọn ${product.name}`}
                      >
                        Chọn món +
                      </button>
                    )}
                    {onViewProduct && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={disabled}
                        onClick={() => onViewProduct(product.id)}
                      >
                        Chi tiết
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <small>
            Giá theo thực đơn đang hiển thị. Chọn món để xem đề xuất trước khi
            xác nhận.
          </small>
        </div>
      )}
      {role === "assistant" && content && <ReadAloud content={products.length ? [visibleContent, ...products.map(product => `${product.name}, ${money(product.price)}`)].join("\n") : content} />}
    </div>
  );
}
