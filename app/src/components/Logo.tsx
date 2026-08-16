/**
 * Icon + wordmark lockup, built from the same mark used for the favicon
 * (public/logo.png). Kept as a plain <img>, matching the rest of the app.
 */
export function Logo({
  size = 28,
  wordmarkClassName = "text-cream tracking-wide",
  iconOnly = false,
}: {
  size?: number;
  wordmarkClassName?: string;
  iconOnly?: boolean;
}) {
  const icon = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      width={size}
      height={Math.round(size * 0.845)}
      style={{ height: size, width: "auto" }}
    />
  );

  if (iconOnly) return icon;

  return (
    <span className="inline-flex items-center gap-2.5">
      {icon}
      <span className={`font-label font-bold uppercase ${wordmarkClassName}`}>
        Strhni<span className="text-gold">Dav</span>
      </span>
    </span>
  );
}
