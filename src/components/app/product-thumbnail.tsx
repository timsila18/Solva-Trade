type ProductThumbnailProps = {
  src?: string | null;
  name: string;
  className?: string;
};

function safeImageSrc(value?: string | null) {
  const src = value?.trim();
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return src;
  return null;
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "P";
  const second = words.length > 1 ? words[1]?.[0] : words[0]?.[1];
  return `${first}${second ?? ""}`.toUpperCase();
}

export function ProductThumbnail({ src, name, className = "h-12 w-12" }: ProductThumbnailProps) {
  const imageSrc = safeImageSrc(src);
  const baseClass = `${className} shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100`;

  if (!imageSrc) {
    return (
      <div className={`${baseClass} grid place-items-center text-xs font-black text-slate-500`} aria-label={`${name} product image placeholder`}>
        {initials(name)}
      </div>
    );
  }

  return (
    <span className={baseClass}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageSrc} alt={`${name} product image`} className="h-full w-full object-cover" loading="lazy" />
    </span>
  );
}
