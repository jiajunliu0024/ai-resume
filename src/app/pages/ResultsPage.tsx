import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";

type ResultsPageProps = {
  onBack: () => void;
};

export function ResultsPage({ onBack }: ResultsPageProps) {
  return (
    <main className="page stack">
      <section className="center stack">
        <div className="success-icon">✓</div>
        <h1>Results Preview</h1>
        <p className="muted">
          This screen will show resume rewrite suggestions and the generated
          cover letter.
        </p>
      </section>

      <Card>
        <div className="section-header">
          <h2>Resume Suggestions</h2>
          <button className="link-button" type="button">
            Copy
          </button>
        </div>
        <p className="muted">AI rewrite suggestions will appear here.</p>
      </Card>

      <Card>
        <div className="section-header">
          <h2>Cover Letter</h2>
          <button className="link-button" type="button">
            Copy
          </button>
        </div>
        <p className="muted">Generated cover letter will appear here.</p>
      </Card>

      <div className="footer-actions">
        <PrimaryButton type="button" variant="secondary" onClick={onBack}>
          Back to Resume
        </PrimaryButton>
      </div>
    </main>
  );
}
