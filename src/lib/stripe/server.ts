import Stripe from "stripe";
import { headers } from "next/headers";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(key, {
      typescript: true,
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return client;
}

/**
 * Resolve the absolute URL for Stripe redirect callbacks.
 *
 * In production, returns `NEXT_PUBLIC_APP_URL` so callbacks always
 * land on the canonical domain. In development, prefer the request's
 * actual host (Next picks 3001 / 3002 / ... when 3000 is taken, and
 * Stripe needs to know where to come back to). Falls back to env if
 * the headers aren't available.
 */
export async function appUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (process.env.NODE_ENV !== "production") {
    try {
      const h = await headers();
      const host = h.get("host");
      if (host) {
        const proto = h.get("x-forwarded-proto") ?? "http";
        return `${proto}://${host}`;
      }
    } catch {
      // headers() throws outside request scope. Fall through to env.
    }
  }

  if (!envUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return envUrl.replace(/\/$/, "");
}
