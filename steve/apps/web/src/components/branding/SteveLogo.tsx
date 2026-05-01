/** Full STEVE Education Intelligence Platform wordmark (bundled asset in `/public`). */
export function SteveLogo({
  variant = "default",
  className = ""
}: {
  variant?: "default" | "compact" | "hero";
  className?: string;
}) {
  const size =
    variant === "compact"
      ? "h-10 max-h-10 w-auto max-w-[9.5rem] object-contain object-left"
      : variant === "hero"
        ? "h-[4.75rem] w-auto max-w-full object-contain object-left sm:h-28 md:h-32"
        : "h-12 w-auto max-w-[11rem] object-contain object-left sm:h-[3.35rem] sm:max-w-[13rem]";

  return (
    <img
      src="/steve-logo.png"
      alt="STEVE — Education Intelligence Platform"
      className={[size, className].filter(Boolean).join(" ")}
      decoding="async"
      fetchPriority="high"
    />
  );
}
