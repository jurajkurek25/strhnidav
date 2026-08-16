import "server-only";
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const COURSE_PRICE_EUR = 249;
export const BLOCK_PRICE_EUR = 99;
