import React from 'react';

// ---------------------------------------------------------------------------
// Individual railcar SVG icon components
// Style: stroke-based silhouettes matching lucide-react conventions
// viewBox="0 0 24 24", stroke="currentColor", strokeWidth="1.5"
// ---------------------------------------------------------------------------

const svgProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/**
 * Cylindrical tank on wheels -- horizontal cylinder sitting on two wheel trucks.
 */
function TankCarIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Tank body — horizontal ellipse / rounded rect */}
      <rect x="3" y="7" width="18" height="8" rx="4" ry="4" />
      {/* Frame rail */}
      <line x1="3" y1="17" x2="21" y2="17" />
      {/* Left wheel truck */}
      <circle cx="7" cy="19" r="1.5" />
      {/* Right wheel truck */}
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

/**
 * Pressurized tank with raised center dome on top of the cylinder.
 */
function PressureCarIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Tank body */}
      <rect x="3" y="8" width="18" height="7" rx="3.5" ry="3.5" />
      {/* Dome on top center */}
      <path d="M9 8 Q9 4 12 4 Q15 4 15 8" />
      {/* Frame rail */}
      <line x1="3" y1="17" x2="21" y2="17" />
      {/* Left wheel */}
      <circle cx="7" cy="19" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

/**
 * Open-top hopper with V-shaped bottom outlets.
 */
function HopperIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Body — trapezoid with V-bottom: open top, sloped sides to hopper gates */}
      <path d="M4 5 L4 12 L8 17 L10 17 L12 14 L14 17 L16 17 L20 12 L20 5" />
      {/* Left wheel */}
      <circle cx="7" cy="19.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="19.5" r="1.5" />
      {/* Frame rail */}
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

/**
 * Covered hopper — closed roof with hatches, V-bottom.
 */
function CoveredHopperIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Roof line */}
      <line x1="4" y1="5" x2="20" y2="5" />
      {/* Roof hatches */}
      <rect x="7" y="3" width="3" height="2" rx="0.5" />
      <rect x="14" y="3" width="3" height="2" rx="0.5" />
      {/* Body walls + V-bottom */}
      <path d="M4 5 L4 12 L8 17 L16 17 L20 12 L20 5" />
      {/* Center V outlet */}
      <path d="M10 12 L12 17 L14 12" />
      {/* Frame rail */}
      <line x1="4" y1="17" x2="20" y2="17" />
      {/* Left wheel */}
      <circle cx="7" cy="19.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  );
}

/**
 * Open-top hopper variant — wider opening, shallower body.
 */
function OpenTopHopperIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Wider open top body with V-bottom */}
      <path d="M3 6 L3 12 L7 17 L11 17 L12 15 L13 17 L17 17 L21 12 L21 6" />
      {/* Rim flare at top */}
      <line x1="2" y1="6" x2="22" y2="6" />
      {/* Frame rail */}
      <line x1="3" y1="17" x2="21" y2="17" />
      {/* Left wheel */}
      <circle cx="7" cy="19.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  );
}

/**
 * Flat car — simple flat deck platform on two wheel trucks.
 */
function FlatCarIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Deck surface */}
      <rect x="2" y="12" width="20" height="2" rx="0.5" />
      {/* Frame / undercarriage */}
      <line x1="2" y1="16" x2="22" y2="16" />
      {/* Vertical supports */}
      <line x1="5" y1="14" x2="5" y2="16" />
      <line x1="19" y1="14" x2="19" y2="16" />
      {/* Left wheel */}
      <circle cx="7" cy="18.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  );
}

/**
 * Gondola — open-top rectangular box on wheels.
 */
function GondolaIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Open-top box body */}
      <path d="M4 6 L4 15 L20 15 L20 6" />
      {/* Frame rail */}
      <line x1="3" y1="15" x2="21" y2="15" />
      {/* Left wheel */}
      <circle cx="7" cy="18" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="18" r="1.5" />
    </svg>
  );
}

/**
 * Boxcar — closed rectangular box with a sliding door indicated.
 */
function BoxcarIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Box body */}
      <rect x="3" y="5" width="18" height="11" rx="0.5" />
      {/* Sliding door (center) */}
      <rect x="9" y="7" width="6" height="9" rx="0.3" />
      {/* Door track / rail */}
      <line x1="3" y1="7" x2="21" y2="7" />
      {/* Frame rail */}
      <line x1="3" y1="17" x2="21" y2="17" />
      {/* Left wheel */}
      <circle cx="7" cy="19.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="19.5" r="1.5" />
    </svg>
  );
}

/**
 * Intermodal — flat car with a shipping container stacked on top.
 */
function IntermodalIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Container box on top */}
      <rect x="4" y="4" width="16" height="8" rx="0.5" />
      {/* Container corrugation lines */}
      <line x1="8" y1="4" x2="8" y2="12" />
      <line x1="16" y1="4" x2="16" y2="12" />
      {/* Flat car deck */}
      <rect x="3" y="12" width="18" height="2" rx="0.5" />
      {/* Frame */}
      <line x1="3" y1="16" x2="21" y2="16" />
      {/* Left wheel */}
      <circle cx="7" cy="18.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="18.5" r="1.5" />
    </svg>
  );
}

/**
 * Auto rack — tall enclosed multi-level carrier with horizontal level lines.
 */
function AutoRackIcon({ className }: { className?: string }) {
  return (
    <svg {...svgProps} className={className}>
      {/* Tall outer shell */}
      <rect x="3" y="2" width="18" height="15" rx="0.5" />
      {/* Level dividers (3 levels) */}
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      {/* Vertical support posts */}
      <line x1="8" y1="2" x2="8" y2="17" />
      <line x1="16" y1="2" x2="16" y2="17" />
      {/* Frame rail */}
      <line x1="3" y1="18" x2="21" y2="18" />
      {/* Left wheel */}
      <circle cx="7" cy="20.5" r="1.5" />
      {/* Right wheel */}
      <circle cx="17" cy="20.5" r="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mapping table: car_type string (lowercase) -> icon component
// ---------------------------------------------------------------------------

const CAR_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  'tank': TankCarIcon,
  'general service tank': TankCarIcon,
  'dot-111 tank car': TankCarIcon,
  'dot-117 pressurized': PressureCarIcon,
  'pressure': PressureCarIcon,
  'pressurized': PressureCarIcon,
  'hopper': HopperIcon,
  'covered hopper': CoveredHopperIcon,
  'open top hopper': OpenTopHopperIcon,
  'flat car': FlatCarIcon,
  'flatcar': FlatCarIcon,
  'gondola': GondolaIcon,
  'boxcar': BoxcarIcon,
  'intermodal': IntermodalIcon,
  'auto rack': AutoRackIcon,
  'autorack': AutoRackIcon,
};

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export function CarTypeIcon({
  type,
  size = 'md',
  className = '',
}: {
  type: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const Icon = CAR_TYPE_ICONS[type?.toLowerCase() ?? ''] || TankCarIcon;
  return <Icon className={`${sizes[size]} flex-shrink-0 ${className}`} />;
}

export {
  TankCarIcon,
  PressureCarIcon,
  HopperIcon,
  CoveredHopperIcon,
  OpenTopHopperIcon,
  FlatCarIcon,
  GondolaIcon,
  BoxcarIcon,
  IntermodalIcon,
  AutoRackIcon,
  CAR_TYPE_ICONS,
};

export default CarTypeIcon;
