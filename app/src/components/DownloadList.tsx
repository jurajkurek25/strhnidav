export function DownloadList({
  items,
}: {
  items: { title: string; url: string }[];
}) {
  if (items.length === 0) return <p className="text-sm text-muted">Zatiaľ nič na stiahnutie.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.url}>
          <a
            href={item.url}
            download
            className="flex items-center gap-2.5 text-sm text-cream hover:text-gold-bright"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  );
}
