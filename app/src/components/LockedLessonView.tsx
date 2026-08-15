import Link from "next/link";
import { LockIcon } from "@/components/LockIcon";
import type { LessonState } from "@/lib/gating";

export function LockedLessonView({
  state,
  unlocksAt,
  dayNumber,
}: {
  state: LessonState;
  unlocksAt: Date | null;
  dayNumber: number;
}) {
  return (
    <div className="card flex flex-col items-center gap-7 px-8 py-24 text-center">
      <div
        aria-hidden
        className="flex aspect-video w-full max-w-xl flex-1 items-center justify-center rounded-sm"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(201,161,48,0.10), transparent 55%), linear-gradient(135deg, #221c15 0%, #12100c 100%)",
        }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-bg">
          <LockIcon size={24} />
        </div>
      </div>

      <h2 className="font-display text-xl font-medium">Lekcia {dayNumber} je zamknutá</h2>

      {state === "locked_paywall" ? (
        <>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Prvých 7 lekcií máš zadarmo. Táto lekcia je súčasťou plného kurzu — odomkni si ho
            jednou platbou 199 €.
          </p>
          <Link href="/dashboard/unlock" className="btn">
            Odomkni celý kurz
          </Link>
        </>
      ) : (
        <>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Táto lekcia sa odomkne, až keď dopozeráš video predchádzajúcej lekcie a splníš jej
            úlohu — a odvtedy prejde jeden deň.
            {unlocksAt && (
              <>
                {" "}
                Odhadovaný termín odomknutia:{" "}
                <b className="text-cream">
                  {unlocksAt.toLocaleDateString("sk-SK", { day: "numeric", month: "long" })}
                </b>
                .
              </>
            )}
          </p>
          <Link href="/dashboard" className="btn btn-ghost">
            Späť na prehľad
          </Link>
        </>
      )}
    </div>
  );
}
