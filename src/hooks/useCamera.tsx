import { useState, useRef, useEffect, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as blazeface from "@tensorflow-models/blazeface";
import "@tensorflow/tfjs-backend-webgl";
import { useIsMobile } from "./use-mobile";
import { CAMERA_CONFIG } from "@/config/camera";

export const useCamera = (location?: string, skipFaceDetection?: boolean) => {
  const [mode, setMode] = useState<"camera" | "preview">("camera");

  //
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [model, setModel] = useState<any>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  //

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
     Start Camera when modal opens
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

        const cameraConstraints = isMobile
          ? CAMERA_CONFIG.mobile
          : CAMERA_CONFIG.desktop;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: cameraConstraints.width,
            height: cameraConstraints.height,
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
    if (skipFaceDetection) {
      setFaceDetected(true);
      return;
    }

    if (!cameraModalOpen || !model) return;

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

      const displayWidth = video.clientWidth;
      const displayHeight = video.clientHeight;

      canvas.width = displayWidth;
      canvas.height = displayHeight;

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

      ctx.drawImage(
        video,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        displayWidth,
        displayHeight
      );

      const imageData = ctx.getImageData(0, 0, displayWidth, displayHeight);
      const predictions = await model.estimateFaces(imageData, false);

      setFaceDetected(predictions.length > 0);

      rafRef.current = requestAnimationFrame(detectLoop);
    };

    rafRef.current = requestAnimationFrame(detectLoop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [cameraModalOpen, model, skipFaceDetection]);

  /* =========================
     Capture Photo
  ========================= */
  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (facingMode === "user") {
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const imageData = canvas.toDataURL("image/jpeg", 0.7);
    setCapturedImage(imageData);
    setMode("preview");
  }, [facingMode]);

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
