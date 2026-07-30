import { useCallback, useRef, useState } from "react";
import { uploadScreenshotRemote } from "../services/googleService";

// Browsers require an explicit user gesture + consent for any screen
// capture (this is a hard privacy/security rule — there's no way to take
// silent screenshots). So this hook exposes an `enable()` call the
// employee must trigger themselves (one click), after which it captures a
// frame every `intervalMinutes` and uploads it, until `disable()` is
// called, the tab closes, or the employee revokes screen-share permission
// from the browser's own UI.
export default function useScreenshotCapture(empId, intervalMinutes = 12) {
  const [enabled, setEnabled] = useState(false);
  const [lastCaptureAt, setLastCaptureAt] = useState(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [error, setError] = useState("");
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const videoRef = useRef(null);

  const captureFrame = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) return;

    const video = videoRef.current || document.createElement("video");
    videoRef.current = video;
    video.srcObject = stream;
    if (video.readyState < 2) {
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
        video.play().catch(() => {});
      });
    }

    const canvas = document.createElement("canvas");
    // Scale down to keep uploads small and fast.
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    canvas.width = (video.videoWidth || maxWidth) * scale;
    canvas.height = (video.videoHeight || 540) * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    const base64 = dataUrl.split(",")[1];

    try {
      const res = await uploadScreenshotRemote(empId, base64, "image/jpeg");
      if (res?.success === false) throw new Error(res.message || "Upload failed");
      setLastCaptureAt(new Date());
      setCaptureCount((c) => c + 1);
      setError("");
    } catch (err) {
      console.error("Screenshot upload failed:", err);
      setError("Couldn't upload the last screenshot — will retry next interval.");
    }
  }, [empId]);

  const enable = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      streamRef.current = stream;
      setEnabled(true);
      setError("");

      // Stop everything automatically if the employee ends screen-share
      // from the browser's own "Stop sharing" control.
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        disable();
      });

      // Take one immediately, then every intervalMinutes.
      captureFrame();
      intervalRef.current = setInterval(captureFrame, intervalMinutes * 60 * 1000);
    } catch (err) {
      console.error("Screen share permission denied or failed:", err);
      setError("Screen sharing permission was denied or cancelled.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureFrame, intervalMinutes]);

  const disable = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setEnabled(false);
  }, []);

  return { enabled, enable, disable, lastCaptureAt, captureCount, error };
}
