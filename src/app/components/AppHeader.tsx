type AppHeaderProps = {
  onOpenSettings: () => void;
  /** Previous step in the scan → resume → tailor → results flow (hidden on Scan). */
  onNavigateBack?: () => void;
};

export function AppHeader({
  onOpenSettings,
  onNavigateBack,
}: AppHeaderProps) {
  return (
    <header className="app-chrome-header">
      <div className="app-chrome-leading">
        <button
          className="icon-button hamburger-button"
          type="button"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="app-chrome-brand">
          <span className="brand-logo">R</span>
          <span className="app-chrome-title">Resume Tailor</span>
        </div>
      </div>
      <div className="app-chrome-trailing">
        {onNavigateBack ? (
          <button
            type="button"
            className="icon-only-button app-chrome-back"
            aria-label="Go back"
            onClick={onNavigateBack}
          >
            ←
          </button>
        ) : null}
      </div>
    </header>
  );
}
