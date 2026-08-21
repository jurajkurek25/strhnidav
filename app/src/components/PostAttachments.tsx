import { publicCommunityAttachmentUrl } from "@/lib/media-urls";

interface Attachment {
  id: string;
  filePath: string;
  fileName: string;
  kind: "image" | "video" | "document";
}

export function PostAttachments({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === "image");
  const videos = attachments.filter((a) => a.kind === "video");
  const documents = attachments.filter((a) => a.kind === "document");

  return (
    <div className="mt-4 flex flex-col gap-3">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {images.map((img) => (
            <a key={img.id} href={publicCommunityAttachmentUrl(img.filePath)} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicCommunityAttachmentUrl(img.filePath)}
                alt={img.fileName}
                className="max-h-[420px] w-full rounded-sm border border-card-line object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {videos.map((video) => (
        <video
          key={video.id}
          src={publicCommunityAttachmentUrl(video.filePath)}
          controls
          className="max-h-[420px] w-full rounded-sm border border-card-line"
        />
      ))}

      {documents.length > 0 && (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <a
                href={publicCommunityAttachmentUrl(doc.filePath)}
                download
                className="flex items-center gap-2.5 text-[13.5px] text-cream hover:text-gold-bright"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
                </svg>
                {doc.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
