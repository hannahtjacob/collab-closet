import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

type ProductJsonLd = {
  "@type"?: string | string[];
  name?: string;
  image?: string | string[];
  category?: string;
  offers?: {
    price?: string | number;
    priceCurrency?: string;
    lowPrice?: string | number;
  } | Array<{ price?: string | number; priceCurrency?: string; lowPrice?: string | number }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function findProduct(value: unknown): ProductJsonLd | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    return value.map(findProduct).find(Boolean);
  }
  const candidate = value as ProductJsonLd & { "@graph"?: unknown[] };
  if (candidate["@type"] && (Array.isArray(candidate["@type"]) ? candidate["@type"].includes("Product") : candidate["@type"] === "Product")) {
    return candidate;
  }
  return candidate["@graph"]?.map(findProduct).find(Boolean);
}

function absoluteUrl(value: string | undefined, sourceUrl: URL) {
  if (!value) return "";
  try {
    return new URL(value, sourceUrl).toString();
  } catch {
    return "";
  }
}

function normalizePrice(value: string, currency = "USD") {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/(?:[$€£¥]|USD|EUR|GBP|CAD|AUD)?\s*\d[\d,]*(?:\.\d{1,2})?/i);
  if (!match) return "";
  const amount = match[0].replace(/\s+/g, " ").trim();
  if (/[$€£¥]/.test(amount) || /\b(?:USD|EUR|GBP|CAD|AUD)\b/i.test(amount)) return amount;
  return `${currency === "USD" ? "$" : `${currency} `}${amount}`;
}

function extractHtmlPrice($: cheerio.CheerioAPI, currency: string) {
  const selectors = [
    '[itemprop="price"]',
    '[property="product:price:amount"]',
    '[data-price]',
    '[data-product-price]',
    '[data-sale-price]',
    '[class*="price"]',
    '[id*="price"]',
  ];

  for (const selector of selectors) {
    const elements = $(selector).toArray();
    for (const element of elements) {
      const value = $(element).attr("content") || $(element).attr("data-price") || $(element).attr("data-product-price") || $(element).text();
      const price = normalizePrice(value || "", currency);
      if (price) return price;
    }
  }

  const visibleText = $("body").text().replace(/\s+/g, " ");
  const match = visibleText.match(/(?:[$€£¥]\s?\d[\d,]*(?:\.\d{1,2})?|(?:USD|EUR|GBP|CAD|AUD)\s?\d[\d,]*(?:\.\d{1,2})?)/i);
  return match ? normalizePrice(match[0], currency) : "";
}

function titleWords(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2));
}

function extractAltMatchedImage($: cheerio.CheerioAPI, name: string, sourceUrl: URL) {
  const productWords = titleWords(name);
  if (!productWords.size) return "";

  let bestImage = "";
  let bestScore = 0;
  $("img[alt]").each((_, element) => {
    const alt = $(element).attr("alt")?.trim() || "";
    const imageSource = $(element).attr("src") || $(element).attr("data-src") || $(element).attr("data-lazy-src") || $(element).attr("srcset")?.split(",")[0]?.trim().split(" ")[0] || "";
    if (!alt || !imageSource || imageSource.startsWith("data:")) return;

    const altWords = titleWords(alt);
    const matchingWords = [...productWords].filter((word) => altWords.has(word)).length;
    const score = matchingWords / Math.max(productWords.size, altWords.size);
    if (matchingWords > 0 && score > bestScore) {
      bestScore = score;
      bestImage = absoluteUrl(imageSource, sourceUrl);
    }
  });

  return bestImage;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const rawUrl = body.url?.trim() || "";
    const sourceUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
      return NextResponse.json({ ok: false, message: "Use an http or https product link." }, { status: 400 });
    }

    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClosetProductPreview/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, message: "That product page could not be read. Enter the details below instead." }, { status: 422 });
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const meta = (name: string) => $(`meta[property="${name}"], meta[name="${name}"]`).first().attr("content")?.trim() || "";
    const jsonProducts = $("script[type='application/ld+json']").toArray().map((element) => {
      try {
        return findProduct(JSON.parse($(element).text()));
      } catch {
        return undefined;
      }
    }).filter((product): product is ProductJsonLd => Boolean(product));
    const product = jsonProducts[0];
    const offer = Array.isArray(product?.offers) ? product?.offers[0] : product?.offers;
    const name = product?.name?.trim() || meta("og:title") || $("title").first().text().trim();
    const altMatchedImage = extractAltMatchedImage($, name, sourceUrl);
    const image = altMatchedImage || absoluteUrl(firstValue(product?.image) || meta("og:image") || meta("twitter:image"), sourceUrl);
    const currency = offer?.priceCurrency || meta("product:price:currency") || "USD";
    const structuredPrice = offer?.price ?? offer?.lowPrice ?? "";
    const price = normalizePrice(String(structuredPrice), currency)
      || normalizePrice(meta("product:price:amount"), currency)
      || extractHtmlPrice($, currency);
    const category = product?.category?.toLowerCase() || "";

    if (!name && !image && !price) {
      return NextResponse.json({ ok: false, message: "This page does not expose product details. Enter the information manually." }, { status: 422 });
    }

    return NextResponse.json({ ok: true, product: { name, imageUrl: image, price, category } });
  } catch {
    return NextResponse.json({ ok: false, message: "That link could not be parsed. Enter the product details manually." }, { status: 422 });
  }
}
