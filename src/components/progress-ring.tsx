import { getTier } from "~/lib/constants";

interface Props {
  power: number;
  attempted: boolean;
  size?: number;
}

export function ProgressRing({ power, attempted, size = 32 }: Props) {
  const r = 12;
  const strokeWidth = 3;
  const cx = 16;
  const cy = 16;
  const circumference = 2 * Math.PI * r;
  const tier = getTier(power, attempted);
  const color = tier?.color ?? "#cbd5e1"; // slate-300 for not-started
  const dashOffset = circumference * (1 - power);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={strokeWidth}
        stroke="#e2e8f0"
        fill="none"
      />
      {/* Arc */}
      {attempted && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          strokeWidth={strokeWidth}
          stroke={color}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
    </svg>
  );
}
