import Link from "next/link";
import { signOutAction } from "@/app/auth/actions";
import { Logo } from "@/components/Logo";

export function Header({
  name,
  avatarUrl,
  isAdmin,
  hasFullAccess,
}: {
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  hasFullAccess: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-card-line bg-bg/85 backdrop-blur-md">
      <nav className="wrap flex items-center justify-between gap-3 py-4 sm:py-6">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="shrink-0">
          <Logo size={26} wordmarkClassName="text-cream tracking-wide text-[15px] sm:text-[19px]" />
        </Link>
        <div className="flex min-w-0 items-center gap-2 sm:gap-7">
          {!isAdmin && !hasFullAccess && (
            <Link href="/dashboard/unlock" className="btn btn-sm !px-3 whitespace-nowrap sm:!px-5">
              <span className="hidden sm:inline">Odomkni celý kurz</span>
              <span className="sm:hidden">Odomknúť</span>
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3.5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                width={30}
                height={30}
                className="rounded-full border border-card-line"
              />
            ) : (
              <div className="h-[30px] w-[30px] rounded-full bg-card border border-card-line" />
            )}
            <span className="hidden text-sm text-muted sm:inline">{name}</span>
          </div>
          <form action={signOutAction} className="shrink-0">
            <button
              type="submit"
              aria-label="Odhlásiť"
              className="btn btn-ghost btn-sm !px-2.5 whitespace-nowrap sm:!px-5"
            >
              <span className="hidden sm:inline">Odhlásiť</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sm:hidden"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
