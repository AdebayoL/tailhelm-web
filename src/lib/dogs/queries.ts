import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type Hours, readHours } from "./hours";

export type Dog = {
  id: string;
  name: string;
  vet_name: string | null;
  vet_phone: string | null;
  out_of_hours_phone: string | null;
  vet_email: string | null;
  breed: string | null;
  date_of_birth: string | null;
  out_of_hours_name: string | null;
  vet_hours: Hours | null;
  out_of_hours_hours: Hours | null;
};

const COLUMNS =
  "id, name, vet_name, vet_phone, out_of_hours_phone, vet_email, breed, date_of_birth, out_of_hours_name, vet_hours, out_of_hours_hours";

/**
 * The signed-in person's first dog, or null. Row-level security returns only
 * dogs in their own household, so no owner filter is needed here.
 */
export const getMyDog = cache(async (): Promise<Dog | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dogs")
    .select(COLUMNS)
    .eq("status", "active")
    .order("created_at")
    .limit(1)
    .maybeSingle<Dog>();
  if (error) throw new Error(`Could not load the dog: ${error.message}`);
  return data && { ...data, vet_hours: readHours(data.vet_hours), out_of_hours_hours: readHours(data.out_of_hours_hours) };
});

/** The names of every active dog the signed-in person shares, oldest first. */
export const getMyDogNames = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dogs").select("name").eq("status", "active").order("created_at");
  if (error) throw new Error(`Could not load the dogs: ${error.message}`);
  return ((data ?? []) as { name: string }[]).map((d) => d.name);
});
