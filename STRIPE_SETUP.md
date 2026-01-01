# Stripe Subscription Setup Guide

Diese Anleitung erklärt, wie die Stripe-Integration für Pro-Abonnements eingerichtet wird.

## 1. Stripe Dashboard Setup

1. Erstelle ein Stripe-Konto unter https://dashboard.stripe.com
2. Wechsle in den **Test-Modus** (Toggle oben rechts)
3. Erstelle ein **Product** mit einem monatlichen **Price** (z.B. "Craft Beer Wizard Pro" - €9.99/Monat)
4. Kopiere die **Price ID** (beginnt mit `price_...`)

## 2. Environment Variables

Füge folgende Variablen zu `.env.local` hinzu:

```env
# Stripe API Keys (aus Stripe Dashboard -> Developers -> API keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Lookup Key (aus Products -> dein Produkt -> Price -> Lookup Key)
# Alternativ: Du kannst auch STRIPE_PRICE_ID=price_... verwenden
STRIPE_LOOKUP_KEY=craft-beer-wizard-pro

# Optional: App URL für Success/Cancel Redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Lookup Key vs. Price ID

Die App verwendet **Lookup Keys** (empfohlen), die flexibler sind. Du kannst auch direkt eine `STRIPE_PRICE_ID` verwenden, indem du `lookup_key` im Request-Body übergibst.

**Lookup Key im Stripe Dashboard setzen:**
1. Gehe zu Products → dein Produkt → Pricing
2. Klicke auf den Price
3. Scrolle zu "Lookup key" und füge einen Key hinzu (z.B. `craft-beer-wizard-pro`)

### Test Keys vs. Live Keys

- **Test-Modus**: Nutze `sk_test_...` und `whsec_test_...`
- **Live-Modus**: Nutze `sk_live_...` und `whsec_live_...`

## 3. Webhook Setup

1. Gehe zu **Developers -> Webhooks** im Stripe Dashboard
2. Klicke auf **"Add endpoint"**
3. **Endpoint URL**: `https://deine-domain.com/api/stripe/webhook`
   - Für lokale Tests: Nutze Stripe CLI (siehe unten)
4. **Events to listen to**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Kopiere das **Signing secret** (beginnt mit `whsec_...`) und füge es zu `.env.local` hinzu

### Lokale Webhook-Tests mit Stripe CLI

```bash
# Installiere Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: Download von https://github.com/stripe/stripe-cli/releases

# Login
stripe login

# Forward Webhooks zu localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Das CLI zeigt dir das Webhook Secret (whsec_...), das du in .env.local eintragen musst
```

## 4. Firebase Extension (Optional)

Für automatische Synchronisation von Stripe-Daten nach Firestore:

1. Gehe zu Firebase Console -> Extensions
2. Installiere **"Run Subscriptions with Stripe"**
3. Folge dem Setup-Wizard
4. Die Extension synchronisiert automatisch Subscriptions in `users/{userId}/subscriptions/`

**Hinweis**: Die manuelle Webhook-Implementierung in `app/api/stripe/webhook/route.ts` funktioniert auch ohne Extension.

## 5. Funktionsweise

### Checkout Flow

1. User klickt auf "Upgrade to Pro"
2. Frontend ruft `/api/checkout` auf mit `userId`
3. Server erstellt Stripe Checkout Session
4. User wird zu Stripe Checkout weitergeleitet
5. Nach erfolgreicher Zahlung:
   - Stripe sendet Webhook an `/api/stripe/webhook`
   - Webhook aktualisiert `users/{userId}` mit `isPro: true`
   - User wird zu `/my-recipes?session_id=...` weitergeleitet

### Recipe Limit

- **Free Users**: Max. 3 Rezepte
- **Pro Users**: Unbegrenzt

Die Prüfung erfolgt in `lib/db.ts` -> `saveRecipe()` Funktion.

### AuthContext

Der `AuthContext` lädt automatisch das User-Profile und stellt `isPro` und `userProfile` bereit:

```typescript
const { user, isPro, userProfile } = useAuth();
```

## 6. Testing

### Test Cards (Stripe Test Mode)

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Verwende beliebiges zukünftiges Datum und CVC.

### Test Webhook Events

```bash
# Test Checkout Session Completed
stripe trigger checkout.session.completed

# Test Subscription Created
stripe trigger customer.subscription.created

# Test Subscription Deleted
stripe trigger customer.subscription.deleted
```

## 7. Troubleshooting

### Webhook wird nicht ausgelöst

- Prüfe, ob Webhook-Endpoint erreichbar ist
- Prüfe Stripe Dashboard -> Webhooks -> Event Logs
- Für lokale Tests: Nutze Stripe CLI `stripe listen`

### User wird nicht auf Pro aktualisiert

- Prüfe Firestore `users/{userId}` Dokument
- Prüfe Webhook-Logs in Stripe Dashboard
- Prüfe Server-Logs für Fehler

### Checkout Session Fehler

- Prüfe, ob `STRIPE_SECRET_KEY` und `STRIPE_PRICE_ID` gesetzt sind
- Prüfe, ob Price ID korrekt ist
- Prüfe Stripe Dashboard -> Logs für API-Fehler

