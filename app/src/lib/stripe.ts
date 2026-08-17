import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const COURSE_PRICE_EUR = 299;
export const BLOCK_PRICE_EUR = 99;
// Monthly alternative to paying COURSE_PRICE_EUR up front. Has cents (29,90
// €), unlike the two integer prices above, so it's defined directly in
// cents to hand to Stripe — never derived via `* 100` at the call site,
// which risks floating-point rounding (0.1 has no exact binary
// representation).
export const SUBSCRIPTION_PRICE_EUR_CENTS = 2990;
export const SUBSCRIPTION_PRICE_EUR = SUBSCRIPTION_PRICE_EUR_CENTS / 100;
