import { useState, useRef, useEffect, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs-backend-webgl";
import { useIsMobile } from "./use-mobile";
import { CAMERA_CONFIG } from "@/config/camera";

export interface CameraOverlayData {
  location?: string;
  tanggalDisplay?: string;
  tanggalEndDisplay?: string;
  jam?: string;
  presensiType?: string;
}

export const useCamera = (overlayData: CameraOverlayData, skipFaceDetection?: boolean) => {
  const [mode, setMode] = useState<"camera" | "preview">("camera");
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [model, setModel] = useState<any>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const isMobile = useIsMobile();

  /* =========================
     Load Face Detection Model
  ========================= */
  useEffect(() => {
    let mounted = true;

    const loadModel = async () => {
      try {
        await tf.ready();
        const loaded = await blazeface.load({
          modelUrl: "/models/blazeface/model.json",
        });
        if (mounted) setModel(loaded);
      } catch (err) {
        console.error("BlazeFace load error", err);
      }
    };

    loadModel();
    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     Start Camera
  ========================= */
  useEffect(() => {
    if (!cameraModalOpen || mode !== "camera") return;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported");
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        const config = isMobile ? CAMERA_CONFIG.mobile : CAMERA_CONFIG.desktop;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: config.width,
            height: config.height,
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error("Camera init error", err);
        alert("Gagal mengakses kamera");
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setFaceDetected(false);
    };
  }, [cameraModalOpen, mode, facingMode, isMobile]);

  /* =========================
     Flip Camera
  ========================= */
  const flipCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  /* =========================
     Face Detection Loop
  ========================= */
  useEffect(() => {
    if (
      skipFaceDetection ||
      facingMode !== "user" ||
      !cameraModalOpen ||
      !model
    ) {
      setFaceDetected(true);
      return;
    }

    let running = true;

    const detectLoop = async () => {
      if (!running) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = video.clientWidth;
      const h = video.clientHeight;

      canvas.width = w;
      canvas.height = h;

      const targetRatio = 4 / 5;
      const videoRatio = video.videoWidth / video.videoHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = video.videoWidth;
      let sHeight = video.videoHeight;

      if (videoRatio > targetRatio) {
        sWidth = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sWidth) / 2;
      } else {
        sHeight = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sHeight) / 2;
      }

      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const predictions = await model.estimateFaces(imageData, false);

      setFaceDetected(predictions.length > 0);

      ctx.restore();
      rafRef.current = requestAnimationFrame(detectLoop);
    };

    rafRef.current = requestAnimationFrame(detectLoop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraModalOpen, model, skipFaceDetection, facingMode]);

  /* =========================
     Helper: Wrapped Text
  ========================= */
  const wrapTextLines = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ) => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const { width } = ctx.measureText(testLine);

      if (width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) lines.push(line);
    return lines;
  };

  const drawJustifiedLine = (
    ctx: CanvasRenderingContext2D,
    words: string[],
    x: number,
    y: number,
    maxWidth: number
  ) => {
    if (words.length === 1) {
      ctx.fillText(words[0], x, y);
      return;
    }

    const wordsWidth = words.reduce(
      (sum, w) => sum + ctx.measureText(w).width,
      0
    );

    const space = (maxWidth - wordsWidth) / (words.length - 1);
    let cursorX = x;

    words.forEach((word, i) => {
      ctx.fillText(word, cursorX, y);
      cursorX += ctx.measureText(word).width;
      if (i < words.length - 1) cursorX += space;
    });
  };

  /* =========================
     Capture Photo
  ========================= */
  const capturePhoto = useCallback(
    (lockedWaktu: string, lockedTanggalDisplay?: string, lockedTanggalEndDisplay?: string) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const w = video.clientWidth;
      const h = video.clientHeight;

      canvas.width = w;
      canvas.height = h;

      const targetRatio = 4 / 5;
      const videoRatio = video.videoWidth / video.videoHeight;

      let sx = 0;
      let sy = 0;
      let sWidth = video.videoWidth;
      let sHeight = video.videoHeight;

      if (videoRatio > targetRatio) {
        sWidth = video.videoHeight * targetRatio;
        sx = (video.videoWidth - sWidth) / 2;
      } else {
        sHeight = video.videoWidth / targetRatio;
        sy = (video.videoHeight - sHeight) / 2;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.save();

      if (facingMode === "user") {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, w, h);
      ctx.restore();

      /* Burn Text */
      const padding = w * 0.045;
      const fontSize = w * 0.032;
      const lineHeight = fontSize * 1.4;
      const maxWidth = w - padding * 2;

      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = "white";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = fontSize * 0.4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const locationText = overlayData.location || "";
      const isSakitIzin = overlayData.presensiType === "Sakit" || overlayData.presensiType === "Izin";
      
      // Determine second line based on presensi type
      let secondLineText: string;
      if (isSakitIzin) {
        // For Sakit/Izin: show date range
        const startDate = lockedTanggalDisplay || overlayData.tanggalDisplay || "";
        const endDate = lockedTanggalEndDisplay || overlayData.tanggalEndDisplay || "";
        secondLineText = `${startDate} - ${endDate}`;
      } else {
        // For Hadir/Pulang: show date and time
        const dateText = lockedTanggalDisplay || overlayData.tanggalDisplay || "";
        const timeText = lockedWaktu || overlayData.jam || "";
        secondLineText = `${dateText}, ${timeText}`;
      }

      // Pecah lokasi jadi baris
      const locationLines = wrapTextLines(ctx, locationText, maxWidth);

      // Hitung tinggi total
      const locationHeight = locationLines.length * lineHeight;
      const secondLineHeight = lineHeight;
      const totalHeight = locationHeight + secondLineHeight;

      // Titik awal dari bawah
      let y = h - padding - totalHeight;

      // Render lokasi
      locationLines.forEach((line, index) => {
        const words = line.split(" ");

        const isLastLine = index === locationLines.length - 1;

        if (isLastLine) {
          ctx.fillText(line, padding, y);
        } else {
          drawJustifiedLine(ctx, words, padding, y, maxWidth);
        }

        y += lineHeight;
      });

      // Render second line (date/time or date range)
      ctx.fillText(secondLineText, padding, y);

      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageData);
      setMode("preview");
    },
    [facingMode, overlayData]
  );

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setMode("camera");
  }, []);

  return {
    cameraModalOpen,
    setCameraModalOpen,
    capturedImage,
    faceDetected,
    videoRef,
    canvasRef,
    capturePhoto,
    retakePhoto,
    mode,
    facingMode,
    flipCamera,
  };
};
