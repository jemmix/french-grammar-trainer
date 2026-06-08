export function LemondeBrandMark({
  size = "lg",
  className,
}: {
  size?: "sm" | "lg";
  className?: string;
}) {
  const h = size === "lg" ? "h-8" : "h-6";
  const w = size === "lg" ? "w-1.5" : "w-1";
  return (
    <div className={`flex gap-0.5 ${className ?? ""}`}>
      <div className={`${w} ${h} rounded-full bg-primary`} />
      <div className={`${w} ${h} rounded-full bg-chalk`} />
      <div className={`${w} ${h} rounded-full bg-accent`} />
    </div>
  );
}
