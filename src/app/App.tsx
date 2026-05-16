import { useEffect, useRef, useState } from "react";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { scanCurrentTab } from "../application/scanCurrentTab";
import { type ScanJobPageResult } from "../application/scanJobPage";
import { type Resume } from "../domain/resume";
import { readActiveTabText } from "../extension/tabs/readActiveTabText";
import {
  extractJobInsightsWithAiProvider,
  isAiProviderId,
  type AiProviderId,
} from "../infrastructure/ai/openAiJobInsightsExtractor";
import { chromeStorageRepository } from "../infrastructure/storage/chromeStorageRepository";
import { storageKeys } from "../shared/storageKeys";
import { SettingsPanel } from "./components/SettingsPanel";
import { AppHeader } from "./components/AppHeader";
import { StepProgress } from "./components/StepProgress";
import { ScanPage } from "./pages/ScanPage";
import { ResumePage } from "./pages/ResumePage";
import { TailorPage } from "./pages/TailorPage";
import { ResultsPage } from "./pages/ResultsPage";

// The app currently uses a simple step string instead of a router.
// This keeps the MVP flow easy to follow inside the extension drawer.
type AppStep = "scan" | "resume" | "tailor" | "results";

const steps: AppStep[] = ["scan", "resume", "tailor", "results"];

export function App() {
  const stepPanelRef = useRef<HTMLDivElement>(null);
  const embeddedInFloatingWidget =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embed") === "floating-widget";

  // currentStep controls which page is visible in the three-step flow.
  const [currentStep, setCurrentStep] = useState<AppStep>("scan");
  // apiKey is kept in React state for the input field, and mirrored to
  // chrome.storage.local so the user does not need to paste it every time.
  const [apiKey, setApiKey] = useState("");
  // aiProvider controls which OpenAI-compatible provider receives the JD text.
  const [aiProvider, setAiProvider] = useState<AiProviderId>("openai");
  // settingsOpen controls the hamburger settings panel.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // scannedJob is the main data object produced by the scan flow. It contains
  // raw JD text, AI requirements, AI keywords, confidence, and debug logs.
  const [scannedJob, setScannedJob] = useState<ScanJobPageResult | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [currentResume, setCurrentResume] = useState<Resume | null>(null);
  // scanError is shown in the Scan page when Chrome scanning or OpenAI fails.
  const [scanError, setScanError] = useState<string | null>(null);
  // isScanning disables the scan button and shows a loading label.
  const [isScanning, setIsScanning] = useState(false);
  const currentStepIndex = steps.indexOf(currentStep);
  const visibleResumes = resumes.length
    ? resumes
    : currentResume
      ? [currentResume]
      : [];

  function handleHeaderBack() {
    if (currentStep === "resume") {
      setCurrentStep("scan");
    } else if (currentStep === "tailor") {
      setCurrentStep("resume");
    } else if (currentStep === "results") {
      setCurrentStep("tailor");
    }
  }

  useEffect(() => {
    if (!embeddedInFloatingWidget) {
      return;
    }

    const html = document.documentElement;
    const { body } = document;
    html.classList.add("embed-floating-widget");
    body.classList.add("embed-floating-widget");
    return () => {
      html.classList.remove("embed-floating-widget");
      body.classList.remove("embed-floating-widget");
    };
  }, [embeddedInFloatingWidget]);

  // Load stored AI settings once when the extension UI opens.
  useEffect(() => {
    void chromeStorageRepository
      .getItem<string>(storageKeys.apiKey)
      .then((storedApiKey) => {
        if (storedApiKey) {
          setApiKey(storedApiKey);
        }
      });

    void chromeStorageRepository
      .getItem<AiProviderId>(storageKeys.aiProvider)
      .then((storedProvider) => {
        if (storedProvider && isAiProviderId(storedProvider)) {
          setAiProvider(storedProvider);
        }
      });

    void chromeStorageRepository
      .getItem<Resume>(storageKeys.currentResume)
      .then((storedResume) => {
        if (storedResume) {
          setCurrentResume(storedResume);
        }
      });

    void chromeStorageRepository
      .getItem<Resume[]>(storageKeys.resumes)
      .then((storedResumes) => {
        if (storedResumes?.length) {
          setResumes(storedResumes);
        }
      });
  }, []);

  // Keep the API key in UI state and persist it locally.
  // We intentionally do not send this key to any custom backend.
  function handleApiKeyChange(nextApiKey: string) {
    setApiKey(nextApiKey);
    void chromeStorageRepository.setItem(storageKeys.apiKey, nextApiKey);
  }

  // Keep the selected provider in UI state and persist it locally.
  function handleAiProviderChange(nextProvider: AiProviderId) {
    setAiProvider(nextProvider);
    void chromeStorageRepository.setItem(storageKeys.aiProvider, nextProvider);
  }

  function handleResumeChange(nextResume: Resume) {
    setCurrentResume(nextResume);
    void chromeStorageRepository.setItem(storageKeys.currentResume, nextResume);
    setResumes((previousResumes) => {
      const nextResumes = [
        nextResume,
        ...previousResumes.filter((resume) => resume.id !== nextResume.id),
      ];

      void chromeStorageRepository.setItem(storageKeys.resumes, nextResumes);
      return nextResumes;
    });
  }

  function handleResumesAdd(nextResumes: Resume[]) {
    if (!nextResumes.length) {
      return;
    }

    const [firstResume] = nextResumes;

    setCurrentResume(firstResume);
    void chromeStorageRepository.setItem(storageKeys.currentResume, firstResume);
    setResumes((previousResumes) => {
      const uploadedIds = new Set(nextResumes.map((resume) => resume.id));
      const mergedResumes = [
        ...nextResumes,
        ...previousResumes.filter((resume) => !uploadedIds.has(resume.id)),
      ];

      void chromeStorageRepository.setItem(storageKeys.resumes, mergedResumes);
      return mergedResumes;
    });
  }

  function handleResumeSelect(resumeId: string) {
    const selectedResume = visibleResumes.find((resume) => resume.id === resumeId);

    if (!selectedResume) {
      return;
    }

    setCurrentResume(selectedResume);
    void chromeStorageRepository.setItem(
      storageKeys.currentResume,
      selectedResume,
    );
  }

  function handleResumeDelete(resumeId: string) {
    setResumes((previousResumes) => {
      const sourceResumes = previousResumes.length
        ? previousResumes
        : currentResume
          ? [currentResume]
          : [];
      const nextResumes = sourceResumes.filter((resume) => resume.id !== resumeId);
      const nextCurrentResume =
        currentResume?.id === resumeId ? nextResumes[0] ?? null : currentResume;

      setCurrentResume(nextCurrentResume);
      void chromeStorageRepository.setItem(storageKeys.resumes, nextResumes);

      if (nextCurrentResume) {
        void chromeStorageRepository.setItem(
          storageKeys.currentResume,
          nextCurrentResume,
        );
      } else {
        void chromeStorageRepository.removeItem(storageKeys.currentResume);
      }

      return nextResumes;
    });
  }

  async function handleClearLocalData() {
    const keysToClear = [
      storageKeys.currentJobDescription,
      storageKeys.currentResume,
      storageKeys.resumes,
      storageKeys.currentResults,
    ];

    await Promise.all(
      keysToClear.map((key) => chromeStorageRepository.removeItem(key)),
    );

    setScannedJob(null);
    setCurrentResume(null);
    setResumes([]);
    setScanError(null);
    setCurrentStep("scan");
    setSettingsOpen(false);
  }

  // Main scan orchestration:
  // 1. Validate API key.
  // 2. Read the active tab text through the Chrome adapter.
  // 3. Send the raw JD text to the selected AI provider for structured extraction.
  // 4. Merge AI insights back into the scan result.
  // 5. Save the final object in React state and chrome.storage.local.
  async function handleScanCurrentPage() {
    if (!apiKey.trim()) {
      setSettingsOpen(true);
      setScanError(null);
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      // result contains raw page text plus a local fallback extraction.
      const result = await scanCurrentTab(readActiveTabText);
      // aiInsights replaces the local fallback with higher-quality extraction.
      const aiInsights = await extractJobInsightsWithAiProvider(
        result.rawText,
        apiKey.trim(),
        aiProvider,
      );
      // Preserve source metadata and debug logs, but replace insights with AI.
      const resultWithAiInsights = {
        ...result,
        title: aiInsights.jobTitle || result.title,
        company: aiInsights.company || result.company,
        requirements: aiInsights.requirements,
        keywords: aiInsights.keywords,
        confidence: aiInsights.confidence,
      };

      // State update drives the current Scan page UI.
      setScannedJob(resultWithAiInsights);
      // Storage update makes the scan result available to later pages.
      await chromeStorageRepository.setItem(
        storageKeys.currentJobDescription,
        resultWithAiInsights,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not scan this page.";
      setScanError(message);
    } finally {
      // Always stop loading, whether the scan succeeds or fails.
      setIsScanning(false);
    }
  }

  return (
    <div
      className={
        embeddedInFloatingWidget ? "app-shell app-shell--embed-floating" : "app-shell"
      }
    >
      <div className="app-chrome-sticky">
        <AppHeader
          onOpenSettings={() => setSettingsOpen(true)}
          onNavigateBack={currentStep === "scan" ? undefined : handleHeaderBack}
        />
        <StepProgress currentStepIndex={currentStepIndex} />
      </div>

      <SettingsPanel
        open={settingsOpen}
        apiKey={apiKey}
        aiProvider={aiProvider}
        onApiKeyChange={handleApiKeyChange}
        onAiProviderChange={handleAiProviderChange}
        onResumePageOpen={() => {
          setCurrentStep("resume");
          setSettingsOpen(false);
        }}
        onClearLocalData={() => {
          void handleClearLocalData();
        }}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="app-step-stage">
        <SwitchTransition mode="out-in">
          <CSSTransition
            nodeRef={stepPanelRef}
            key={currentStep}
            timeout={{ enter: 280, exit: 220 }}
            classNames="app-step"
            unmountOnExit
            appear={false}
          >
            <div ref={stepPanelRef} className="app-step-panel">
              {currentStep === "scan" ? (
                <ScanPage
                  apiKeyConfigured={Boolean(apiKey.trim())}
                  error={scanError}
                  isScanning={isScanning}
                  scannedJob={scannedJob}
                  onNext={() => setCurrentStep("resume")}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onScan={handleScanCurrentPage}
                />
              ) : currentStep === "resume" ? (
                <ResumePage
                  apiKey={apiKey}
                  aiProvider={aiProvider}
                  jobTitle={scannedJob?.title}
                  resumes={visibleResumes}
                  resume={currentResume}
                  onBack={() => setCurrentStep("scan")}
                  onResumesAdd={handleResumesAdd}
                  onResumeDelete={handleResumeDelete}
                  onResumeSelect={handleResumeSelect}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onNext={() => setCurrentStep("tailor")}
                />
              ) : currentStep === "tailor" ? (
                <TailorPage
                  apiKey={apiKey}
                  aiProvider={aiProvider}
                  job={scannedJob}
                  resume={currentResume}
                  onBack={() => setCurrentStep("resume")}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onResumeChange={handleResumeChange}
                  onNext={() => setCurrentStep("results")}
                />
              ) : (
                <ResultsPage
                  job={scannedJob}
                  resume={currentResume}
                  apiKey={apiKey}
                  aiProvider={aiProvider}
                  onBack={() => setCurrentStep("tailor")}
                  onGoToScan={() => setCurrentStep("scan")}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              )}
            </div>
          </CSSTransition>
        </SwitchTransition>
      </div>
    </div>
  );
}
