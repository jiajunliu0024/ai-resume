import {
  RESUME_TAILOR_MINIMIZE_PANEL,
  type ResumeTailorMinimizeMessage,
} from "../../shared/floatingWidgetMessages";

type AppHeaderProps = {
  onOpenSettings: () => void;
  /** True when UI runs inside the page-embedded floating widget iframe (not the extension popup). */
  embeddedInFloatingWidget: boolean;
};

export function AppHeader({ onOpenSettings, embeddedInFloatingWidget }: AppHeaderProps) {
  function handleCloseChrome() {
    if (embeddedInFloatingWidget) {
      const payload: ResumeTailorMinimizeMessage = { type: RESUME_TAILOR_MINIMIZE_PANEL };
      window.parent.postMessage(payload, "*");
      return;
    }
    window.close();
  }

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
      <button
        type="button"
        className="icon-only-button app-chrome-close"
        aria-label={embeddedInFloatingWidget ? "Minimize panel" : "Close extension"}
        onClick={handleCloseChrome}
      >
        ×
      </button>
    </header>
  );
}
