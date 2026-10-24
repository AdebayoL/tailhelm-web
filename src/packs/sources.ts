import register from "../../sources/register.json";
import { type Citation, SourceRegister } from "./schema";

const SOURCES = new Map(SourceRegister.parse(register).sources.map((s) => [s.id, s]));

/** Where a rule shown to the owner comes from: "Source: <title>, <section>". Null for a source the register doesn't hold. */
export function citeLine(citation: Citation): string | null {
  const source = SOURCES.get(citation.sourceId);
  return source ? `Source: ${source.title}, ${citation.section}.` : null;
}
