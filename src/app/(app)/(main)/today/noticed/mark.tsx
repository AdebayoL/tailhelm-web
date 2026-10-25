"use client";

import { useEffect } from "react";
import { markNoticed } from "./actions";

/** Records that an observation was shown or opened, once it is on screen. */
export function MarkNoticed({ id, seen }: { id: string; seen: "shown" | "opened" }) {
  useEffect(() => {
    void markNoticed(id, seen);
  }, [id, seen]);
  return null;
}
