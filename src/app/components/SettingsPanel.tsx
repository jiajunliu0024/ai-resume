import { useRef, useState } from "react";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { type AiProviderId } from "../../infrastructure/ai/openAiJobInsightsExtractor";
import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";

type SettingsPanelProps = {
  open: boolean;
  apiKey: string;
  aiProvider: AiProviderId;
  onApiKeyChange: (apiKey: string) => void;
  onAiProviderChange: (provider: AiProviderId) => void;
  onResumePageOpen: () => void;
  onClearLocalData: () => void;
  onClose: () => void;
};

export function SettingsPanel({
  open,
  apiKey,
  aiProvider,
  onApiKeyChange,
  onAiProviderChange,
  onResumePageOpen,
  onClearLocalData,
  onClose,
}: SettingsPanelProps) {
  const [activeView, setActiveView] = useState<"menu" | "apiKey">("menu");
  const shellRef = useRef<HTMLDivElement>(null);
  const settingsViewRef = useRef<HTMLDivElement>(null);

  return (
    <CSSTransition
      in={open}
      nodeRef={shellRef}
      timeout={{ enter: 260, exit: 220 }}
      classNames="settings-shell"
      unmountOnExit
      appear
      onEnter={() => setActiveView("menu")}
    >
      <div ref={shellRef} className="settings-backdrop" role="presentation">
        <aside className="settings-panel" aria-label="Settings">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Settings</span>
            <h2>{activeView === "menu" ? "Menu" : "API Key Settings"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="settings-panel-body">
          <SwitchTransition mode="out-in">
            <CSSTransition
              nodeRef={settingsViewRef}
              key={activeView}
              timeout={{ enter: 220, exit: 180 }}
              classNames="settings-view"
              unmountOnExit
              appear={false}
            >
              <div ref={settingsViewRef} className="settings-view-panel stack">
                {activeView === "menu" ? (
                  <div className="settings-menu">
                    <button
                      className="settings-menu-item"
                      type="button"
                      onClick={() => setActiveView("apiKey")}
                    >
                      <span>
                        <strong>API Key Settings</strong>
                        <small>Provider and local API key</small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                    <button
                      className="settings-menu-item"
                      type="button"
                      onClick={onResumePageOpen}
                    >
                      <span>
                        <strong>Resume Library</strong>
                        <small>Upload, select, and edit resumes</small>
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                    <button
                      className="settings-menu-item danger-menu-item"
                      type="button"
                      onClick={onClearLocalData}
                    >
                      <span>
                        <strong>Clear Local Data</strong>
                        <small>Reset resumes, scanned JD, and results only</small>
                      </span>
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="link-button settings-back-button"
                      type="button"
                      onClick={() => setActiveView("menu")}
                    >
                      ← Back to settings
                    </button>

                    <Card>
                      <label className="field-label" htmlFor="settings-ai-provider">
                        Provider
                      </label>
                      <select
                        id="settings-ai-provider"
                        className="text-input"
                        value={aiProvider}
                        onChange={(event) =>
                          onAiProviderChange(event.target.value as AiProviderId)
                        }
                      >
                        <option value="openai">OpenAI</option>
                        <option value="deepseek">DeepSeek</option>
                      </select>

                      <label
                        className="field-label field-label-spaced"
                        htmlFor="settings-ai-api-key"
                      >
                        API key
                      </label>
                      <input
                        id="settings-ai-api-key"
                        className="text-input"
                        type="password"
                        value={apiKey}
                        placeholder="Paste your API key"
                        onChange={(event) => onApiKeyChange(event.target.value)}
                      />
                      <p className="helper-text">
                        Your key is stored locally in this browser and used only to call
                        the selected provider directly from the extension.
                      </p>
                    </Card>

                    <PrimaryButton type="button" onClick={onClose}>
                      Save Settings
                    </PrimaryButton>
                  </>
                )}
              </div>
            </CSSTransition>
          </SwitchTransition>
        </div>
      </aside>
      </div>
    </CSSTransition>
  );
}
