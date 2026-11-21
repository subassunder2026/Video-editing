import React, { useState } from 'react';
import { Check, Copy, Download, ExternalLink, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1.5 text-xs font-medium text-[#E5892E] transition-colors hover:text-[#F4A553] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        Install App
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setShowGuide(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-white/10 bg-[#141418] p-5 text-left shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h2 className="text-sm font-semibold text-[#ECECEF]">
                Install ChromaGrade on Your Device
              </h2>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded p-1 text-[#8E8E98] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#A0A0AA]">
                <p className="text-[#ECECEF]">
                  Install ChromaGrade to your Home Screen via Safari:
                </p>
                <ol className="list-decimal space-y-1.5 pl-4">
                  <li>
                    Tap the <strong className="text-white">Share</strong> button in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-white">Add</strong> to launch ChromaGrade standalone.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#A0A0AA]">
                {isInIframe ? (
                  <p className="text-[#D4D4DC]">
                    Browsers only enable the 1-click desktop installer when the app is opened in its own top-level tab (outside the embedded preview frame).
                  </p>
                ) : (
                  <p className="text-[#D4D4DC]">
                    Install ChromaGrade as a standalone offline-ready desktop application in Chrome, Edge, or Brave:
                  </p>
                )}

                <ol className="list-decimal space-y-2 pl-4">
                  {isInIframe && (
                    <li>
                      Open ChromaGrade in a standalone browser tab using the link below (or the workspace&apos;s <strong className="text-white">Open in new tab</strong> button).
                    </li>
                  )}
                  <li>
                    Click the <strong className="text-white">Install App</strong> button in the top bar, or click the install icon in your browser&apos;s address bar (or menu <strong className="text-white">⋮ → Cast, save, and share → Install page as app</strong>).
                  </li>
                  <li>
                    ChromaGrade will appear on your desktop / Applications folder and work offline with full GPU WebGL2 grading.
                  </li>
                </ol>

                <div className="mt-4 flex items-center gap-2 pt-1">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#E5892E] px-3 py-2 text-xs font-semibold text-[#0C0C0E] transition-colors hover:bg-[#EE9842] whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Standalone Tab
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="flex items-center justify-center gap-1.5 rounded border border-white/15 bg-[#1B1B20] px-3 py-2 text-xs font-medium text-[#ECECEF] transition-colors hover:border-white/30 whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#4CC37A]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded border border-[#E5892E]/40 bg-[#1B1814] px-3 py-1.5 text-xs font-medium text-[#E5892E] shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Local GPU grading active</span>
    </div>
  );
};
