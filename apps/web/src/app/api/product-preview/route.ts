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
    const image = absoluteUrl(firstValue(product?.image) || meta("og:image") || meta("twitter:image"), sourceUrl);
    const name = product?.name?.trim() || meta("og:title") || $("title").first().text().trim();
    const rawPrice = offer?.price ?? offer?.lowPrice ?? meta("product:price:amount");
    const currency = offer?.priceCurrency || meta("product:price:currency") || "USD";
    const price = rawPrice ? `${currency === "USD" ? "$" : `${currency} `}${rawPrice}` : "";
    const category = product?.category?.toLowerCase() || "";

    if (!name && !image && !price) {
      return NextResponse.json({ ok: false, message: "This page does not expose product details. Enter the information manually." }, { status: 422 });
    }

    return NextResponse.json({ ok: true, product: { name, imageUrl: image, price, category } });
  } catch {
    return NextResponse.json({ ok: false, message: "That link could not be parsed. Enter the product details manually." }, { status: 422 });
  }
}
