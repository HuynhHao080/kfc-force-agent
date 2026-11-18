// Next.js local test-response hook; no font download.
// Compilation fixture only, never a production font replacement.
module.exports = new Proxy({}, {
  get(_target, url) {
    if (typeof url !== "string" || !url.startsWith("https://fonts.googleapis.com/css2?")) return undefined;
    const family = url.includes("Geist+Mono") ? "Geist Mono" : "Geist";
    return `@font-face { font-family: '${family}'; font-style: normal; font-weight: 100 900; }`;
  },
});
