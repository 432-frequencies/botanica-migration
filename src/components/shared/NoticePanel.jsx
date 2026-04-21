export default function NoticePanel({
  icon: Icon,
  label,
  message,
  tone = "info",
  action = null,
  dismiss = null,
  className = "",
}) {
  const tones = {
    info: {
      bg: "rgba(21,101,192,0.08)",
      border: "rgba(21,101,192,0.22)",
      color: "var(--v1v-blue)",
    },
    warning: {
      bg: "rgba(232,122,0,0.08)",
      border: "rgba(232,122,0,0.22)",
      color: "#E87A00",
    },
    error: {
      bg: "rgba(208,48,48,0.08)",
      border: "rgba(208,48,48,0.22)",
      color: "var(--v1v-danger-text)",
    },
    success: {
      bg: "rgba(63,163,77,0.08)",
      border: "rgba(63,163,77,0.22)",
      color: "var(--v1v-green)",
    },
  };

  const palette = tones[tone] || tones.info;

  return (
    <div
      className={`v1v-notice ${className}`.trim()}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        {Icon ? <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: palette.color }} /> : null}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: palette.color }}>
            {label}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
            {message}
          </p>
        </div>
        {action}
        {dismiss}
      </div>
    </div>
  );
}
