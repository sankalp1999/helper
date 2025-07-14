import { create } from "zustand";

export const useScreenshotStore = create<{
  screenshot: { response: string | null } | null;
  setScreenshot: (screenshot: { response: string | null } | null) => void;
  isCapturingScreenshot: boolean;
  screenshotError: string | null;
  setIsCapturingScreenshot: (isCapturing: boolean) => void;
  setScreenshotError: (error: string | null) => void;
}>((set) => ({
  screenshot: null,
  setScreenshot: (screenshot) => set({ screenshot }),
  isCapturingScreenshot: false,
  screenshotError: null,
  setIsCapturingScreenshot: (isCapturingScreenshot) => set({ isCapturingScreenshot }),
  setScreenshotError: (screenshotError) => set({ screenshotError }),
}));
