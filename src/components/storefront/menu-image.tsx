"use client";
import Image from "next/image";
import { useState } from "react";
import { menuImageForItem } from "@/lib/menu-images";

export function MenuImage({
  imageUrl,
  alt,
  width,
  height,
  priority = false,
}: {
  imageUrl?: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const original = menuImageForItem(imageUrl, alt);
  const source =
    failedSource === original ? "/images/fried-chicken.svg" : original;
  return (
    <Image
      src={source}
      alt={alt}
      width={width}
      height={height}
      sizes="(max-width: 600px) 50vw, 320px"
      priority={priority}
      unoptimized={source.startsWith("https://")}
      onError={() => setFailedSource(original)}
    />
  );
}
