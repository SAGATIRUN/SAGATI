// components/MindVectorPanel/MindVectorEmoji.tsx
/**
 * MindVectorEmoji.tsx
 *
 * Purpose:
 * - Visual, animated emoji/meme/icon component representing a user's Mind Vector / mental state.
 * - Supports: plain emoji chars, image assets, SVG sprites, animations, tooltips, keyboard accessibility.
 *
 * Usage:
 * <MindVectorEmoji
 *   vector={mindVector}                     // optional: object with visualState, emoji, timestamp, dimensions
 *   size="md"                                // 'sm' | 'md' | 'lg' | number(px)
 *   variant="auto"                            // 'auto'|'emoji'|'image'|'svg'
 *   customMap={customMap}                     // optional mapping of states -> emoji/image
 *   onClick={(v) => console.log(v)}           // click handler (also keyboard accessible)
 *   showLabel
 * />
 *
 * Notes:
 * - Written with Tailwind utility classes. Replace or remove if not using Tailwind.
 * - Uses framer-motion for animations. Install via `yarn add framer-motion`.
 */

import React, { KeyboardEvent, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type MindVectorDimension = { name: string; value: number };
export type MindVector = {
  timestamp?: string;
  dimensions?: MindVectorDimension[];
  visualState?: string; // e.g., "BalancedFlow", "MindOverheat", "Anxious"
  emoji?: string; // optional emoji character fallback
  imageUrl?: string; // optional image url for meme/asset
};

export type EmojiMappingEntry = {
  emoji?: string; // unicode emoji char
  imageUrl?: string; // relative path or full URL to image asset
  svgId?: string; // id within an SVG sprite (if using sprite)
  label?: string; // friendly label / tooltip text
  tone?: "danger" | "warn" | "ok" | "info" | "muted"; // UI tone
};

export type MindVectorEmojiProps = {
  vector?: MindVector | null;
  visualStateOverride?: string;
  size?: "sm" | "md" | "lg" | number;
  variant?: "auto" | "emoji" | "image" | "svg";
  customMap?: Record<string, EmojiMappingEntry>;
  animation?: boolean;
  onClick?: (vector?: MindVector) => void;
  className?: string;
  showLabel?: boolean;
  tooltip?: boolean;
  ariaLabel?: string;
  accessible?: boolean;
  // optional: intensity controls how pronounced animation is 0..1
  intensity?: number;
};

// ---------- Default mapping ----------
// You can expand this mapping or override via `customMap` prop.
const DEFAULT_MAPPING: Record<string, EmojiMappingEntry> = {
  BalancedFlow: { emoji: "😌", label: "Balanced Flow", tone: "ok" },
  MindOverheat: { emoji: "🔥", label: "Mind Overheat", tone: "danger" },
  Anxious: { emoji: "😬", label: "Anxious", tone: "warn" },
  Impulsive: { emoji: "⚡", label: "Impulsive", tone: "warn" },
  Disciplined: { emoji: "🧭", label: "Disciplined", tone: "ok" },
  FaithDriven: { emoji: "🕊️", label: "Faith-driven", tone: "ok" },
  Unknown: { emoji: "❔", label: "Unknown", tone: "muted" },
};

// ---------- Helpers ----------
function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** compute a simple intensity 0..1 for animation from vector:
 * - If vector has specific dimension named 'intensity' or 'impulsivity', prefer it.
 * - Otherwise compute variance / average magnitude across dimensions.
 */
function computeIntensity(vector?: MindVector, fallback = 0.4) {
  if (!vector || !Array.isArray(vector.dimensions) || vector.dimensions.length === 0) {
    return fallback;
  }

  const dims = vector.dimensions;
  // prefer explicit keys
  const explicit =
    dims.find((d) => /intens|impuls|volat|freq/i.test(d.name)) ||
    dims.find((d) => d.name.toLowerCase() === "intensity");
  if (explicit) return clamp01(Number(explicit.value) ?? fallback);

  // compute normalized variance (0..1)
  const values = dims.map((d) => Number(d.value) || 0);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  // scale variance to 0..1 (heuristic)
  const scaled = Math.tanh(variance * 4);
  return clamp01(scaled || fallback);
}

function toneToColor(tone?: EmojiMappingEntry["tone"]) {
  switch (tone) {
    case "danger":
      return "text-red-400/90";
    case "warn":
      return "text-amber-300/90";
    case "ok":
      return "text-green-300/90";
    case "info":
      return "text-sky-300/90";
    default:
      return "text-slate-300/80";
  }
}

function sizeToPixels(size: MindVectorEmojiProps["size"]) {
  if (typeof size === "number") return size;
  switch (size) {
    case "sm":
      return 36;
    case "lg":
      return 96;
    default:
      return 56; // md
  }
}

// ---------- Motion variants ----------
const baseVariants = {
  idle: { scale: 1, rotate: 0 },
  pulse: (intensity: number) => ({
    scale: 1 + 0.06 * intensity,
    transition: { yoyo: Infinity, duration: 0.9 - 0.4 * intensity },
  }),
  jitter: (intensity: number) => ({
    rotate: [ -3 * intensity, 3 * intensity, -2 * intensity, 2 * intensity, 0 ],
    transition: { repeat: Infinity, duration: 0.7 - 0.3 * intensity, ease: "easeInOut" },
  }),
  bigWiggle: (intensity: number) => ({
    rotate: [ -12 * intensity, 12 * intensity, -8 * intensity, 8 * intensity, 0 ],
    scale: [1, 1.12, 1, 1.08, 1],
    transition: { repeat: Infinity, duration: 1.2 - 0.5 * intensity, ease: "easeInOut" },
  }),
} as const;

// ---------- Component ----------
export default function MindVectorEmoji(props: MindVectorEmojiProps) {
  const {
    vector,
    visualStateOverride,
    size = "md",
    variant = "auto",
    customMap,
    animation = true,
    onClick,
    className = "",
    showLabel = false,
    tooltip = true,
    ariaLabel,
    accessible = true,
    intensity: intensityOverride,
  } = props;

  const visualState = (visualStateOverride || vector?.visualState || "Unknown").trim() || "Unknown";

  // combine maps with defaults (user custom overrides default)
  const mapping = useMemo(() => {
    return {
      ...DEFAULT_MAPPING,
      ...(customMap || {}),
    } as Record<string, EmojiMappingEntry>;
  }, [customMap]);

  // pick entry
  const entry: EmojiMappingEntry = mapping[visualState] || mapping[Object.keys(mapping).find(k => k.toLowerCase() === visualState.toLowerCase()) || "Unknown"] || mapping.Unknown;

  // actual displayed values
  const displayEmoji = entry.emoji || vector?.emoji || "❔";
  const displayImage = entry.imageUrl || vector?.imageUrl || undefined;
  const displayLabel = entry.label || visualState || "Mind State";
  const tone = entry.tone || "muted";

  const px = sizeToPixels(size);
  const animIntensity = clamp01(Number(intensityOverride ?? computeIntensity(vector, 0.45)));

  // determine animation variant based on state / tone
  const chosenVariant = useMemo(() => {
    if (!animation) return "idle";
    const s = visualState.toLowerCase();
    if (s.includes("overheat") || s.includes("heat") || s.includes("panic") || tone === "danger") return "bigWiggle";
    if (s.includes("anx") || s.includes("nerv") || tone === "warn") return "jitter";
    if (s.includes("impuls") || s.includes("freq")) return "pulse";
    return "idle";
  }, [visualState, animation, tone]);

  // Build ARIA label
  const finalAriaLabel = ariaLabel || `${displayLabel} — updated ${vector?.timestamp ?? "unknown"}`;

  // click / keyboard handlers
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(vector ?? undefined);
    }
  }

  // Render helpers
  const EmojiContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={visualState + (displayEmoji || "") + (displayImage || "")}
        custom={animIntensity}
        initial={{ opacity: 0, scale: 0.8, rotate: 0 }}
        animate={{
          opacity: 1,
          scale: baseVariants.idle.scale,
          rotate: baseVariants.idle.rotate,
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.18 }}
        style={{ width: px, height: px, display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-hidden={!accessible}
      >
        {/* variant: image -> show image if imageUrl; emoji -> show char; svg -> placeholder support for svgId */}
        {displayImage && (variant === "image" || variant === "auto") ? (
          <motion.img
            src={displayImage}
            alt={displayLabel}
            loading="lazy"
            style={{ width: px, height: px, borderRadius: px * 0.18 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.28 }}
            onError={(e) => {
              // fallback to emoji if image fails to load
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : displayEmoji && (variant === "emoji" || variant === "auto") ? (
          // emoji char
          <motion.span
            role="img"
            aria-label={displayLabel}
            title={tooltip ? displayLabel : undefined}
            style={{ fontSize: Math.round(px * 0.72), lineHeight: 1 }}
            animate={
              chosenVariant === "pulse"
                ? { scale: [1, 1 + 0.06 * animIntensity, 1] }
                : chosenVariant === "jitter"
                ? { rotate: [ -3 * animIntensity, 3 * animIntensity, -2 * animIntensity, 2 * animIntensity, 0 ] }
                : chosenVariant === "bigWiggle"
                ? { rotate: [ -10 * animIntensity, 10 * animIntensity, 0 ], scale: [1, 1.08, 1] }
                : { scale: 1 }
            }
            transition={{ repeat: chosenVariant === "idle" ? 0 : Infinity, duration: 0.9 - 0.35 * animIntensity, ease: "easeInOut" }}
            className="select-none"
          >
            {displayEmoji}
          </motion.span>
        ) : (
          // fallback bubble with first-letter
          <motion.div
            className="flex items-center justify-center rounded-md bg-slate-700/40"
            style={{ width: px, height: px }}
          >
            <span className="text-slate-200 text-sm">{displayLabel?.[0] ?? "?"}</span>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  // border / glow color based on tone
  const borderColorClass = toneToColor(tone);

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : -1}
      aria-label={accessible ? finalAriaLabel : undefined}
      onKeyDown={handleKeyDown}
      onClick={() => onClick?.(vector ?? undefined)}
    >
      <div
        className={`relative rounded-full flex items-center justify-center ${borderColorClass}`}
        style={{
          width: px + 8,
          height: px + 8,
        }}
        title={tooltip ? `${displayLabel}` : undefined}
      >
        {/* animated inner */}
        <motion.div
          key={`inner-${visualState}`}
          custom={animIntensity}
          initial={{ scale: 0.98 }}
          animate={
            chosenVariant === "pulse"
              ? { scale: [1, 1 + 0.04 * animIntensity, 1] }
              : chosenVariant === "jitter"
              ? { translateX: [0, 1.8 * animIntensity, -1.2 * animIntensity, 0] }
              : chosenVariant === "bigWiggle"
              ? { rotate: [ -3 * animIntensity, 3 * animIntensity, 0 ] }
              : { scale: 1 }
          }
          transition={{ repeat: chosenVariant === "idle" ? 0 : Infinity, duration: 1.0 - 0.3 * animIntensity, ease: "easeInOut" }}
        >
          {EmojiContent}
        </motion.div>

        {/* small badge indicating tone */}
        <span
          aria-hidden
          className={`absolute -bottom-0.5 -right-1 w-3 h-3 rounded-full ${tone === "danger" ? "bg-red-500" : tone === "warn" ? "bg-amber-400" : tone === "ok" ? "bg-green-400" : "bg-slate-500"}`}
          style={{ boxShadow: "0 0 6px rgba(0,0,0,0.25)" }}
        />
      </div>

      {/* optional label / meta */}
      {showLabel ? (
        <div className="flex flex-col">
          <div className="text-sm font-medium text-slate-100">{displayLabel}</div>
          <div className="text-xs text-slate-400">
            {vector?.timestamp ? new Date(vector.timestamp).toLocaleString() : "no data"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Integration notes:
 * - If you use this inside SSR (Next.js), the component is safe: it doesn't directly
 *   access `window` at module top-level. framer-motion runs in React on client only.
 * - Provide `customMap` when you want to map internal visualState strings to specific meme assets:
 *     <MindVectorEmoji customMap={{ "MindOverheat": { imageUrl: "/emoji/mind_overheat.png", label: "Overheat" } }} />
 * - For sprite SVG support: you can add logic to render <svg><use href="#icon-id" /></svg> when svgId is present.
 * - To animate intensity based on a specific dimension, ensure your backend includes a `intensity` or `impulsivity` dimension.
 *
 * Accessibility:
 * - `aria-label` is provided automatically, but you can override via `ariaLabel` prop.
 * - If `onClick` is provided the wrapper is keyboard-focusable and responds to Enter/Space.
 *
 * Styling:
 * - Tailwind utility classes are used in this file. If you don't have Tailwind, replace classes with your own CSS.
 *
 * Extensibility:
 * - You can add a small context menu on right-click to open the raw vector JSON, or open the user's dashboard.
 * - To show a hovering detailed tooltip, integrate a tooltip library (e.g. headlessui / tippy) and use `displayLabel + vector` as content.
 */
