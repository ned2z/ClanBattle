/**
 * Price sparkline.
 *
 * Two things this component is careful about:
 *
 * 1. TEXT. The <svg> uses preserveAspectRatio="none" so the graph stretches to
 *    any width, but that also stretches glyphs — a <text> inside would render
 *    as a stretched smear. So all numbers are rendered as HTML siblings, never
 *    inside the SVG.
 *
 * 2. STROKE WIDTH. Stretching also scales the stroke, so a 2px line becomes a
 *    fat blob on a wide screen. vectorEffect="non-scaling-stroke" pins the
 *    stroke width regardless of the transform.
 */

export interface SparklineProps {
  data: number[];
  /** Stroke and fill tint; usually green for rising, red for falling. */
  color?: string;
  /** Show a dot on the newest point. */
  mark?: boolean;
  height?: number;
  className?: string;
}

const VB_W = 100;
const VB_H = 30;

export function Sparkline({ data, color = '#f6c453', mark = true, height = 56, className = '' }: SparklineProps) {
  const pts = data.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return <div className={`flex items-center justify-center text-[12px] text-stone-500 ${className}`} style={{ height }}>ข้อมูลไม่พอ</div>;
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  // A flat series would divide by zero; give it a nominal band instead.
  const span = max - min || Math.max(1, max * 0.1);
  const lo = min - span * 0.12;
  const hi = max + span * 0.12;
  const range = hi - lo;

  const x = (i: number) => (i / (pts.length - 1)) * VB_W;
  const y = (v: number) => VB_H - ((v - lo) / range) * VB_H;

  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`;
  const gid = `sp${Math.abs(hashStr(data.join(',') + color))}`;
  const last = pts[pts.length - 1];

  return (
    <div className={className} style={{ height }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        role="img"
        aria-label={`กราฟราคา ${pts.length} วัน ล่าสุด ${last}`}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {mark && (
          <circle
            cx={x(pts.length - 1)}
            cy={y(last)}
            r={2.2}
            fill={color}
            stroke="rgba(0,0,0,.65)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

/** Stable-enough string hash for a gradient id; ids only need to be unique per render tree. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export const trendColor = (change: number): string =>
  change > 0.05 ? '#6fbf4a' : change < -0.05 ? '#e0523f' : '#a8a29e';

export const trendArrow = (change: number): string => (change > 0.05 ? '▲' : change < -0.05 ? '▼' : '—');
