"use client";

import { clearOfflinePages } from "@/lib/offline/client";
import { signOut } from "../../sign-in/actions";

/** Signs out after deleting the pages kept on this phone for offline use. */
export function SignOutButton() {
  return (
    <form
      action={async () => {
        await clearOfflinePages();
        await signOut();
      }}
    >
      <button type="submit" className="min-h-12 text-lg text-green underline underline-offset-4">
        Sign out
      </button>
    </form>
  );
}
