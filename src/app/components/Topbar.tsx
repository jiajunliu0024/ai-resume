type TopbarProps = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="topbar">
      <button
        className="icon-button hamburger-button"
        type="button"
        aria-label="Open settings"
        onClick={onMenuClick}
      >
        <span />
        <span />
        <span />
      </button>
      <div className="brand">
        <span className="brand-logo">R</span>
        <span>Resume Tailor</span>
      </div>
      <span className="topbar-spacer" aria-hidden="true" />
    </header>
  );
}
