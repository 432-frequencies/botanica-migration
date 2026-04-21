export default function PageIntro({ kicker, title, subtitle, rightSlot = null, sticky = false, className = "" }) {
  return (
    <div className={`v1v-page-header ${sticky ? "v1v-page-header-sticky" : ""} ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {kicker && <p className="v1v-page-kicker">{kicker}</p>}
          <h1 className="v1v-page-title">{title}</h1>
          {subtitle && <p className="v1v-page-subtitle">{subtitle}</p>}
        </div>
        {rightSlot ? <div className="flex shrink-0 items-center gap-2">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
