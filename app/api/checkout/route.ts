import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not configured");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(request: NextRequest) {
  try {
    const { userId, lookup_key } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get lookup_key from request body or environment variable
    const lookupKey = lookup_key || process.env.STRIPE_LOOKUP_KEY;

    if (!lookupKey) {
      return NextResponse.json(
        { error: "Stripe lookup key is not configured. Please provide lookup_key or set STRIPE_LOOKUP_KEY in environment variables." },
        { status: 500 }
      );
    }


    // Get price by lookup_key
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ['data.product'],
    });

    if (prices.data.length === 0) {
      return NextResponse.json(
        { error: `No price found for lookup_key: ${lookupKey}` },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      billing_address_collection: 'auto',
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1,
        },
      ],
      success_url: `${origin}/my-recipes?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-recipes?canceled=true`,
      client_reference_id: userId, // Pass userId to identify the user in webhook
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
