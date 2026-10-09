import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/session";

/** Checks sign-in again on the server; the proxy has already redirected most visitors. */
export function OwnerOnly() {
  return (
    <Suspense fallback={null}>
      <Check />
    </Suspense>
  );
}

async function Check() {
  await requireOwner();
  return null;
}
