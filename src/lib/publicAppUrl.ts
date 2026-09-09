const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

export const PUBLIC_APP_ORIGIN = (
  configuredOrigin || "https://mboficina.mentebinaria.com"
).replace(/\/+$/, "");
