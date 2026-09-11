import type { CSSProperties } from 'react'

// Decorative background for the features section: a wireframe figure at
// work, ringed by floating UI-window cards that drift independently. Pure
// SVG + CSS animation (see .decor-float-* and .decor-hover-layer in
// globals.css), no canvas or client-only APIs, so it renders fine on the
// server like the rest of the page.
//
// Each floating layer is two nested <g>s: the outer one carries the slow
// translateY float loop, the inner one carries the hover scale-up. Keeping
// them on separate elements means the running float animation never fights
// the hover transform for control of the `transform` property.
export default function ThinkerScene({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      viewBox="0 0 640 480"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="thinkerGlow" cx="52%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#98fb98" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#98fb98" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="640" height="480" fill="url(#thinkerGlow)" />

      {/* seated figure, thinking pose */}
      <g
        stroke="#ffffff"
        strokeOpacity="0.16"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <circle cx="300" cy="150" r="26" />
        <path d="M256 190 C230 230 224 300 240 360 C260 400 340 410 372 380 C396 356 392 260 366 210 C352 186 322 176 300 176 C286 176 268 180 256 190 Z" />
        <path d="M262 220 C258 270 262 320 280 360" />
        <path d="M320 200 C334 250 336 310 322 360" />
        <path d="M268 210 C250 220 240 236 246 252 C250 264 268 268 282 258" />
        <path d="M244 360 C220 372 200 372 176 356" />
        <path d="M372 380 C400 388 424 380 440 360" />
        <path d="M176 356 C168 366 170 380 184 386" />
        <path d="M440 360 C452 368 452 382 438 390" />
      </g>

      {/* laptop, resting on the lap */}
      <g stroke="var(--accent)" fill="none" strokeLinejoin="round">
        <rect x="272" y="300" width="72" height="46" rx="4" strokeOpacity="0.55" strokeWidth="2" />
        <path
          d="M264 350 L352 350 L344 346 L272 346 Z"
          fill="var(--accent)"
          fillOpacity="0.1"
          stroke="var(--accent)"
          strokeOpacity="0.4"
          strokeWidth="2"
        />
        <path d="M282 312 H336" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M282 322 H320" strokeOpacity="0.3" strokeWidth="1.5" />
        <path d="M282 332 H328" strokeOpacity="0.3" strokeWidth="1.5" />
      </g>

      {/* floating UI-window cards */}
      <g className="decor-float-a">
        <g className="decor-hover-layer">
          <rect
            x="56"
            y="66"
            width="126"
            height="82"
            rx="10"
            stroke="#98fb98"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            fill="var(--card)"
            fillOpacity="0.5"
          />
          <circle cx="75" cy="85" r="3" fill="#98fb98" fillOpacity="0.6" />
          <circle cx="87" cy="85" r="3" fill="var(--accent)" fillOpacity="0.5" />
          <path d="M68 106 H150" stroke="#98fb98" strokeOpacity="0.25" strokeWidth="1.5" />
          <path d="M68 120 H124" stroke="#98fb98" strokeOpacity="0.2" strokeWidth="1.5" />
          <path d="M68 134 H140" stroke="#98fb98" strokeOpacity="0.2" strokeWidth="1.5" />
        </g>
      </g>

      <g className="decor-float-b">
        <g className="decor-hover-layer">
          <rect
            x="436"
            y="46"
            width="132"
            height="88"
            rx="10"
            stroke="var(--violet)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            fill="var(--card)"
            fillOpacity="0.5"
          />
          <circle cx="455" cy="66" r="3" fill="var(--violet)" fillOpacity="0.6" />
          <circle cx="467" cy="66" r="3" fill="var(--accent)" fillOpacity="0.5" />
          <path d="M448 88 H556" stroke="var(--violet)" strokeOpacity="0.25" strokeWidth="1.5" />
          <path d="M448 102 H516" stroke="var(--violet)" strokeOpacity="0.2" strokeWidth="1.5" />
          <path d="M448 116 H540" stroke="var(--violet)" strokeOpacity="0.2" strokeWidth="1.5" />
        </g>
      </g>

      <g className="decor-float-c">
        <g className="decor-hover-layer">
          <rect
            x="436"
            y="296"
            width="112"
            height="74"
            rx="10"
            stroke="var(--accent)"
            strokeOpacity="0.35"
            strokeWidth="1.5"
            fill="var(--card)"
            fillOpacity="0.5"
          />
          <circle cx="455" cy="315" r="3" fill="var(--accent)" fillOpacity="0.6" />
          <circle cx="467" cy="315" r="3" fill="#98fb98" fillOpacity="0.5" />
          <path d="M448 334 H528" stroke="var(--accent)" strokeOpacity="0.25" strokeWidth="1.5" />
          <path d="M448 348 H504" stroke="var(--accent)" strokeOpacity="0.2" strokeWidth="1.5" />
        </g>
      </g>

      <g className="decor-float-b">
        <circle
          className="decor-hover-layer"
          cx="92"
          cy="330"
          r="16"
          stroke="var(--accent)"
          strokeOpacity="0.4"
          strokeWidth="2"
          fill="none"
        />
      </g>

      <g className="decor-float-a">
        <path
          className="decor-hover-layer"
          d="M556 218 L584 266 L528 266 Z"
          stroke="var(--violet)"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  )
}
