import { useState, useRef, useEffect, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs-backend-webgl";
import { useIsMobile } from "./use-mobile";
import { CAMERA_CONFIG } from "@/config/camera";

export const useCamera = (location?: string, skipFaceDetection?: boolean) => {
  const [mode, setMode] = useState<"camera" | "preview">("camera");

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [model, setModel] = useState<any>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectionsRef = useRef<any[]>([]);

  const isMobile = useIsMobile();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await tf.ready();
        const blaze = await blazeface.load({
          modelUrl: "/models/blazeface/model.json", // ⬅️ path lokal
        });
        if (mounted) setModel(blaze);
      } catch (err) {
        console.error("model load error", err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize camera when modal opens
  useEffect(() => {
    async function startCamera() {
      try {
        // FIX: Check if getUserMedia is available
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not available");
        }

        // Stop existing stream before starting new one
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // FIX: Use explicit width/height constraints to force portrait mode
        const cameraConstraints = isMobile
          ? CAMERA_CONFIG.mobile
          : CAMERA_CONFIG.desktop;

        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: cameraConstraints.width,
            height: cameraConstraints.height,
            // Additional constraint to ensure portrait
            aspectRatio: { ideal: 0.8 }, // 4:5 (width:height) for portrait
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("camera init error", err);
        alert("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
      }
    }
    if (cameraModalOpen && mode === "camera") startCamera();
    return () => {
      // Clean up camera stream when modal closes or component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Cancel any running animation frame
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCameraActive(false);
      setFaceDetected(false);
    };
  }, [cameraModalOpen, mode, facingMode]);

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  // Face detection loop (only when not skipping)
  useEffect(() => {
    // Skip face detection if skipFaceDetection is true
    if (skipFaceDetection) {
      setFaceDetected(true); // Always allow capture
      return;
    }

    let rafId: number;
    let running = true;

    async function loop() {
      if (!running) return;

      if (
        !cameraModalOpen ||
        !model ||
        !videoRef.current ||
        !canvasRef.current ||
        videoRef.current.readyState < 2
      ) {
        if (running) rafId = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        if (running) rafId = requestAnimationFrame(loop);
        return;
      }

      // Ukuran tampilan elemen video (UI)
      const displayWidth = video.clientWidth;
      const displayHeight = video.clientHeight;
      canvas.width = displayWidth;
      canvas.height = displayHeight;

      // FIX: Target ratio for portrait (width:height = 4:5)
      const targetRatio = 0.8; // 4:5 portrait ratio (width/height)

      const videoRatio = video.videoWidth / video.videoHeight;

      // Tentukan area crop dari video asli agar sesuai targetRatio
      let sx = 0,
        sy = 0,
        sWidth = video.videoWidth,
        sHeight = video.videoHeight;
      if (videoRatio > targetRatio) {
        // video lebih lebar → crop kiri-kanan
        sWidth = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sWidth) / 2;
      } else {
        // video lebih tinggi → crop atas-bawah
        sHeight = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sHeight) / 2;
      }

      // Buat canvas offscreen untuk crop sesuai aspect ratio
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = displayWidth;
      offscreenCanvas.height = displayHeight;
      const offCtx = offscreenCanvas.getContext("2d");
      if (!offCtx) return;

      // Crop area dari video → scale ke display
      offCtx.drawImage(
        video,
        sx,
        sy,
        sWidth,
        sHeight, // sumber (crop area)
        0,
        0,
        displayWidth,
        displayHeight // tujuan (sesuai UI)
      );

      // BlazeFace bisa langsung detect pada elemen video
      const imageData = offCtx.getImageData(0, 0, displayWidth, displayHeight);
      const predictions = await model.estimateFaces(imageData, false);

      const detected = predictions && predictions.length > 0;
      setFaceDetected(detected);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detected) {
        ctx.strokeStyle = "rgba(34,197,94,0.9)";
        ctx.lineWidth = 3;

        predictions.forEach((pred) => {
          const [x, y] = pred.topLeft as [number, number];
          const [x2, y2] = pred.bottomRight as [number, number];
          ctx.strokeRect(x, y, x2 - x, y2 - y);
        });
      }

      if (running) rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [cameraModalOpen, model, skipFaceDetection]);

  // Fungsi helper untuk membungkus teks panjang
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ) {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";

    words.forEach((word) => {
      const testLine = line + word + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== "") {
        lines.push(line.trim());
        line = word + " ";
      } else {
        line = testLine;
      }
    });
    lines.push(line.trim());
    return lines;
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const maxWidth = 640; // target lebar
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth * scale;
    captureCanvas.height = video.videoHeight * scale;

    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    // === Gambar video ===
    ctx.save();
    // Only mirror for front camera (user)
    if (facingMode === "user") {
      ctx.scale(-1, 1);
      ctx.drawImage(
        video,
        -captureCanvas.width,
        0,
        captureCanvas.width,
        captureCanvas.height
      );
    } else {
      ctx.drawImage(
        video,
        0,
        0,
        captureCanvas.width,
        captureCanvas.height
      );
    }
    ctx.restore(); // reset biar teks tidak ikut mirror

    // === Overlay teks ===
    const currentTime = new Date().toLocaleString("id-ID");
    const locationText = location || "Lokasi tidak tersedia";

    const fontSize = Math.max(13, captureCanvas.width / 35);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "white";

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    const padding = 19;
    const lineHeight = fontSize * 1.4;

    const wrappedLocation = wrapText(
      ctx,
      locationText,
      captureCanvas.width - padding * 2
    );

    const lines = [...wrappedLocation, currentTime];
    const startY = captureCanvas.height - padding;

    lines.forEach((line, index) => {
      const y = startY - (lines.length - 1 - index) * lineHeight;
      ctx.fillText(line, padding, y);
    });

    // Simpan hasil gambar
    const imageData = captureCanvas.toDataURL("image/jpeg", 0.7);

    // hitung ukuran file
    function dataURLtoBlob(dataurl: string) {
      const arr = dataurl.split(",");
      const mime = arr[0].match(/:(.*?);/)![1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    }

    const blob = dataURLtoBlob(imageData);
    // console.log("Ukuran gambar:", (blob.size / 1024).toFixed(2), "KB");

    setCapturedImage(imageData);
    setMode("preview");
  }, [isMobile, location, facingMode]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setMode("camera");
  }, []);

  return {
    cameraActive,
    setCameraActive,
    cameraModalOpen,
    setCameraModalOpen,
    capturedImage,
    setCapturedImage,
    faceDetected,
    model,
    videoRef,
    canvasRef,
    streamRef,
    rafRef,
    detectionsRef,
    capturePhoto,
    retakePhoto,
    mode,
    setMode,
    facingMode,
    flipCamera,
  };
};
