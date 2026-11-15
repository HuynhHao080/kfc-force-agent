const illustrations = [
  "burger",
  "combo",
  "fried-chicken",
  "fries",
  "pepsi",
  "wings",
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
