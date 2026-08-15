import Link from "next/link";

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
      <nav className="wrap flex items-center justify-between py-4">
        <Link href={isAdmin ? "/admin" : "/dashboard"} className="font-label text-[22px] font-bold uppercase tracking-wide text-cream">
          Strhni<span className="text-gold">Dav</span>
        </Link>
        <div className="flex items-center gap-5">
          {!isAdmin && !hasFullAccess && (
            <Link href="/dashboard/unlock" className="btn btn-sm">
              Odomkni celý kurz
            </Link>
          )}
          <div className="flex items-center gap-2.5">
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
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">
              Odhlásiť
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
