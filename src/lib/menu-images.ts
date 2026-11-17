const illustrations = [
  "burger",
  "combo",
  "fried-chicken",
  "fries",
  "pepsi",
  "wings",
  "burger-1",
  "combo-1",
  "pepsi-1",
];

const legacyFoodImages = [
  { source: "/images/burger.svg", name: "burger", replacement: "/images/burger-1.svg" },
  { source: "/images/combo.svg", name: "combo", replacement: "/images/combo-1.svg" },
  { source: "/images/pepsi.svg", name: "pepsi", replacement: "/images/pepsi-1.svg" },
];

export function isKfcImage(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      [
        "kfcvietnam.com.vn",
        "static.kfcvietnam.com.vn",
        "kfcvn-static.cognizantorderserv.com",
      ].includes(url.hostname) &&
      /\.(?:png|jpe?g|webp|avif)$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function isMenuImage(value: string): boolean {
  return (
    illustrations.some((name) => value === `/images/${name}.svg`) ||
    isKfcImage(value)
  );
}

export function menuImage(value?: string): string {
  const normalized = value?.replace(/^(\/images\/[^/]+)\.png$/, "$1.svg");
  return normalized && isMenuImage(normalized)
    ? normalized
    : "/images/fried-chicken.svg";
}

export function menuImageForItem(value: string | undefined, name: string): string {
  const normalized = value?.replace(/^(\/images\/[^/]+)\.png$/, "$1.svg");
  const matchingLegacyImage = legacyFoodImages.find(
    (image) => normalized === image.source && name.toLowerCase().includes(image.name),
  );
  return matchingLegacyImage?.replacement ?? menuImage(value);
}
