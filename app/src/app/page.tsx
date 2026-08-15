import { redirect } from "next/navigation";

// Authenticated visitors never reach this component — middleware redirects
// them to /admin or /dashboard first. This only renders for guests.
export default function Home() {
  redirect("/login");
}
