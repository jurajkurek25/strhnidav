import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SuggestionSchema = z.array(
  z.object({
    id: z.string(),
    score: z.number().min(1).max(10),
    reason: z.string(),
  })
);

export type MatchSuggestion = z.infer<typeof SuggestionSchema>[number];

export interface MatchCandidate {
  id: string;
  name: string;
  bio: string;
}

const SYSTEM_PROMPT = `Si citlivý a rešpektujúci asistent komunity kurzu osobnostného rozvoja "Strhni Dav",
ktorý na základe krátkych textových predstavení (bio) navrhuje, ktorí členovia komunity by si
mohli mať čo povedať. Posudzuj VÝLUČNE na základe poskytnutého textu — nič si nedomýšľaj a
nevytváraj si domnienky o veku, vzhľade ani iných necharakterových vlastnostiach. Buď slušný,
neopisuj nikoho negatívne. Vráť VÝLUČNE JSON pole objektov v tvare
[{"id": string, "score": number 1-10, "reason": string}], zoradené od najvyššieho skóre.
"reason" napíš po slovensky, v 1 vete, priateľsky, adresované osobe, ktorá si návrh pozerá
(2. osoba, napr. "Obaja máte radi turistiku a hovoríte o podobnom prístupe k...").
Nezaraď nikoho, koho bio neposkytuje vôbec žiadny reálny podklad na porovnanie.`;

function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("no-json");
  return JSON.parse(match[0]);
}

export async function suggestMatches(
  viewerBio: string,
  candidates: MatchCandidate[]
): Promise<MatchSuggestion[]> {
  if (candidates.length === 0) return [];

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Moje bio:\n"""\n${viewerBio}\n"""\n\nKandidáti:\n${candidates
          .map((c) => `- id: ${c.id}\n  meno: ${c.name}\n  bio: ${c.bio}`)
          .join("\n")}`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = SuggestionSchema.parse(extractJson(text));
  const candidateIds = new Set(candidates.map((c) => c.id));
  return parsed.filter((s) => candidateIds.has(s.id));
}
