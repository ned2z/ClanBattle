/**
 * Antique clock dial.
 *
 * The hands track the in-game clock, not wall-clock time. The game runs much
 * faster than real life — four map nodes is 20 in-game minutes but about
 * eight real seconds — so a real-time hand would sit still all day and the
 * dial would look broken.
 *
 * The minute hand ticks one mark at a time like a mechanical movement while
 * the hour hand sweeps, which is both prettier than a continuous sweep and
 * easier to read at a glance on a small dial.
 *
 * Note there is deliberately no preserveAspectRatio="none" here: the numerals
 * are <text> inside the SVG, and stretching the box would smear them. The
 * dial is a fixed-size square, so nothing needs to stretch.
 */

const R = 50;                 // dial radius in the 100x100 viewBox
const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Polar -> cartesian, 0 at 12 o'clock, clockwise. */
function hand(angleDeg: number, len: number, w: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: R + Math.cos(a) * len, y: R + Math.sin(a) * len, w };
}

export function ClockDial({ day, minute, size = 64, phaseIcon, phaseColor }: {
  day: number;
  minute: number;
  size?: number;
  phaseIcon: string;
  phaseColor: string;
}) {
  const m = ((minute % 1440) + 1440) % 1440;
  const hour = m / 60;
  // Minutes *within the hour*, not total minutes — otherwise 30:00 would be
  // 10800 degrees, i.e. thirty full turns back to twelve o'clock.
  // Math.floor makes the minute hand tick one mark at a time.
  const minuteAngle = Math.floor(m % 60) * 6;
  const hourAngle = hour * 30;

  const mm = hand(minuteAngle, R - 11, 3.2);
  const hh = hand(hourAngle, R - 21, 4.6);

  // A dimmer ring on the left half reads as the night side of the dial.
  const nightHalf = hour >= 19 || hour < 6;

  return (
    <div className="flex shrink-0 flex-col items-center" style={{ width: size }}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`เวลา ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')} วันที่ ${day}`}
      >
        <defs>
          <linearGradient id="clockBezel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a24a" />
            <stop offset="45%" stopColor="#8a6a2f" />
            <stop offset="100%" stopColor="#5c4520" />
          </linearGradient>
          <radialGradient id="clockFace" cx="50%" cy="38%" r="72%">
            <stop offset="0%" stopColor={nightHalf ? '#d8cba8' : '#f4ead0'} />
            <stop offset="100%" stopColor={nightHalf ? '#b3a684' : '#ddcfa8'} />
          </radialGradient>
        </defs>

        {/* brass bezel */}
        <circle cx="50" cy="50" r="48" fill="url(#clockBezel)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke="#3a2a10" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="41" fill="url(#clockFace)" stroke="#6b5b2e" strokeWidth="1" />

        {/* minute ticks */}
        {Array.from({ length: 60 }, (_, i) => {
          const a = ((i * 6 - 90) * Math.PI) / 180;
          const long = i % 5 === 0;
          const r0 = long ? 32 : 35;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * r0} y1={50 + Math.sin(a) * r0}
              x2={50 + Math.cos(a) * 38} y2={50 + Math.sin(a) * 38}
              stroke={long ? '#3b2a14' : '#8a7a5a'} strokeWidth={long ? 1.8 : 0.9}
            />
          );
        })}

        {/* roman numerals */}
        {NUMERALS.map((n, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          return (
            <text
              key={n}
              x={50 + Math.cos(a) * 26} y={50 + Math.sin(a) * 26}
              textAnchor="middle" dominantBaseline="central"
              fontSize={i % 3 === 0 ? 11 : 9}
              fontWeight="700" fill="#3b2a14" fontFamily="Georgia, 'Times New Roman', serif"
            >
              {n}
            </text>
          );
        })}

        {/* hands */}
        <line x1="50" y1="50" x2={hh.x} y2={hh.y} stroke="#2a1a02" strokeWidth={hh.w} strokeLinecap="round" />
        <line x1="50" y1="50" x2={mm.x} y2={mm.y} stroke="#2a1a02" strokeWidth={mm.w} strokeLinecap="round" />
        <circle cx="50" cy="50" r="3.4" fill="#c9a24a" stroke="#2a1a02" strokeWidth="1" />
      </svg>

      <div className="-mt-1 text-center leading-none">
        <div className="text-[11px] font-bold text-amber-200" style={{ textShadow: '0 1px 0 #000' }}>วันที่ {day}</div>
        <div className="text-[10px]" style={{ color: phaseColor }}>{phaseIcon}</div>
      </div>
    </div>
  );
}
