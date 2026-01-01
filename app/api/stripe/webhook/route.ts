import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc, getDoc } from "firebase/firestore";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not configured");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.clover",
});

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;

        if (!userId) {
          console.error("No userId found in session");
          break;
        }

        // Update user profile to mark as Pro
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          isPro: true,
          subscriptionStatus: "active",
          stripeCustomerId: session.customer,
        });

        console.log(`User ${userId} upgraded to Pro`);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          console.error("No userId found in subscription metadata");
          break;
        }

        // Update subscription status
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          await updateDoc(userRef, {
            isPro: subscription.status === "active" || subscription.status === "trialing",
            subscriptionStatus: subscription.status,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
          });
        } else {
          // Create user profile if it doesn't exist
          await setDoc(userRef, {
            isPro: subscription.status === "active" || subscription.status === "trialing",
            subscriptionStatus: subscription.status,
            stripeCustomerId: subscription.customer,
            stripeSubscriptionId: subscription.id,
            createdAt: new Date(),
          });
        }

        // Also store in subscriptions subcollection (for Firebase Extension compatibility)
        const subscriptionRef = doc(db, "users", userId, "subscriptions", subscription.id);
        const subscriptionData: any = {
          status: subscription.status,
          customer: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
          cancel_at_period_end: subscription.cancel_at_period_end,
          metadata: subscription.metadata || {},
        };
        
        // Add period dates if available (access via index signature)
        const sub = subscription as any;
        if (sub.current_period_start) {
          subscriptionData.current_period_start = new Date(
            typeof sub.current_period_start === "number" 
              ? sub.current_period_start * 1000 
              : new Date(sub.current_period_start)
          );
        }
        if (sub.current_period_end) {
          subscriptionData.current_period_end = new Date(
            typeof sub.current_period_end === "number"
              ? sub.current_period_end * 1000
              : new Date(sub.current_period_end)
          );
        }
        
        await setDoc(subscriptionRef, subscriptionData, { merge: true });

        console.log(`Subscription ${subscription.id} updated for user ${userId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (!userId) {
          console.error("No userId found in subscription metadata");
          break;
        }

        // Remove Pro status
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          isPro: false,
          subscriptionStatus: "canceled",
        });

        console.log(`User ${userId} subscription canceled`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: error.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// Disable body parsing, we need the raw body for signature verification
export const runtime = "nodejs";

// Disable body parsing for this route
export const dynamic = "force-dynamic";
