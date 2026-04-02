export const TONE_VARIANTS = {
  default: {
    badgeSolid: "border-border/80 bg-secondary text-secondary-foreground",
    badgeOutline: "border-border/80 text-foreground",
    softSurface: "border-border/70 bg-muted/35 text-foreground",
    subtleSurface: "border-border/70 bg-muted/25 text-muted-foreground",
    text: "text-foreground",
    dot: "var(--tone-neutral-dot)",
  },
  success: {
    badgeSolid: "border-success/35 bg-success/15 text-success",
    badgeOutline: "border-success/45 text-success",
    softSurface: "border-success/35 bg-success/15 text-success",
    subtleSurface: "border-success/30 bg-success/10 text-success",
    text: "text-success",
    dot: "var(--tone-success-dot)",
  },
  warning: {
    badgeSolid: "border-warning/40 bg-warning/15 text-warning",
    badgeOutline: "border-warning/50 text-warning",
    softSurface: "border-warning/40 bg-warning/15 text-warning",
    subtleSurface: "border-warning/35 bg-warning/12 text-warning",
    text: "text-warning",
    dot: "var(--tone-warning-dot)",
  },
  info: {
    badgeSolid: "border-info/35 bg-info/15 text-info",
    badgeOutline: "border-info/45 text-info",
    softSurface: "border-info/35 bg-info/15 text-info",
    subtleSurface: "border-info/30 bg-info/10 text-info",
    text: "text-info",
    dot: "var(--tone-info-dot)",
  },
  danger: {
    badgeSolid: "border-destructive/35 bg-destructive/12 text-destructive",
    badgeOutline: "border-destructive/45 text-destructive",
    softSurface: "border-destructive/35 bg-destructive/15 text-destructive",
    subtleSurface: "border-destructive/30 bg-destructive/10 text-destructive",
    text: "text-destructive",
    dot: "var(--tone-danger-dot)",
  },
};

const TONE_ALIAS = {
  neutral: "default",
  slate: "default",
  emerald: "success",
  green: "success",
  amber: "warning",
  yellow: "warning",
  sky: "info",
  blue: "info",
  rose: "danger",
  red: "danger",
  destructive: "danger",
};

export function resolveTone(variant = "default") {
  const key = TONE_ALIAS[variant] ?? variant;
  return TONE_VARIANTS[key] ?? TONE_VARIANTS.default;
}

export function toneClass(variant = "default", slot = "badgeSolid") {
  return resolveTone(variant)[slot] ?? TONE_VARIANTS.default[slot] ?? "";
}

export function toneDotColor(variant = "default") {
  return resolveTone(variant).dot ?? TONE_VARIANTS.default.dot;
}
