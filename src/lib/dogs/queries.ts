import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Dog = {
  id: string;
  name: string;
  vet_name: string | null;
  vet_phone: string | null;
  out_of_hours_phone: string | null;
  vet_email: string | null;
};

const COLUMNS = "id, name, vet_name, vet_phone, out_of_hours_phone, vet_email";

/**
 * The signed-in person's first dog, or null. Row-level security returns only
 * dogs in their own household, so no owner filter is needed here.
 */
export async function getMyDog(): Promise<Dog | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dogs")
    .select(COLUMNS)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle<Dog>();
  if (error) throw new Error(`Could not load the dog: ${error.message}`);
  return data;
}
