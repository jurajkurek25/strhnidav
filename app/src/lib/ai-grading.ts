import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VerdictSchema = z.object({
  approved: z.boolean(),
  feedback: z.string(),
});

export type GradingVerdict = z.infer<typeof VerdictSchema>;

const SYSTEM_PROMPT = `Si prísny, ale férový lektor online kurzu psychológie osobnosti "Strhni Dav".
Tvojou jedinou úlohou je posúdiť, či účastník naozaj splnil zadanú dennú úlohu na základe toho,
čo odovzdal. Buď zhovievavý k forme (preklepy, stručnosť) ale prísny k obsahu — odovzdaný materiál
musí reálne súvisieť so zadaním a ukazovať, že úlohu vykonal, nielen že ju okomentoval.
Odpovedz VÝLUČNE JSON objektom v tvare {"approved": boolean, "feedback": string}.
"feedback" napíš po slovensky, v 1-3 vetách, priateľsky, priamo účastníkovi (2. osoba).
Ak approved=false, feedback musí vysvetliť čo chýba a čo má doplniť.`;

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no-json");
  return JSON.parse(match[0]);
}

export async function gradeTextSubmission(
  lessonTitle: string,
  taskPrompt: string | null,
  submissionText: string
): Promise<GradingVerdict> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Lekcia: ${lessonTitle}\nZadanie úlohy: ${taskPrompt ?? "(bez špecifického zadania)"}\n\nOdpoveď účastníka:\n"""\n${submissionText}\n"""`,
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  return VerdictSchema.parse(extractJson(text));
}

export async function gradeFileSubmission(
  lessonTitle: string,
  taskPrompt: string | null,
  fileBase64: string,
  mediaType: string,
  kind: "image" | "pdf"
): Promise<GradingVerdict> {
  const fileBlock =
    kind === "image"
      ? ({
          type: "image",
          source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: fileBase64 },
        } as const)
      : ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
        } as const);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Lekcia: ${lessonTitle}\nZadanie úlohy: ${taskPrompt ?? "(bez špecifického zadania)"}\n\nÚčastník odovzdal priložený súbor ako dôkaz splnenia úlohy.`,
          },
          fileBlock,
        ],
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  return VerdictSchema.parse(extractJson(text));
}
