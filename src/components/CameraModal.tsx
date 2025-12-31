import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, RefreshCw, CameraIcon, SwitchCamera } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  faceDetected: boolean;
  isNeedDetected: boolean;
  onCapture: () => void;
  location: string;
  imageUrl: string | null;
  onRetake: () => void;
  mode: "camera" | "preview";
  // New props for Sakit/Izin
  presensiType?: string;
  facingMode?: "user" | "environment";
  onFlipCamera?: () => void;
}

export const CameraModal = ({
  isOpen,
  onClose,
  videoRef,
  canvasRef,
  faceDetected,
  isNeedDetected,
  onCapture,
  location,
  imageUrl,
  onRetake,
  mode,
  presensiType,
  facingMode = "user",
  onFlipCamera,
}: CameraModalProps) => {
  const isSakitOrIzin = presensiType === "Sakit" || presensiType === "Izin";

  const getTitle = () => {
    if (mode === "preview") return "Preview Foto";
    if (presensiType === "Sakit") return "Foto Surat Sakit";
    if (presensiType === "Izin") return "Foto Surat Izin";
    return "Ambil Foto Presensi";
  };

  const getDescription = () => {
    if (presensiType === "Sakit") {
      return "Ambil foto surat keterangan sakit dari dokter atau bukti pendukung lainnya";
    }
    if (presensiType === "Izin") {
      return "Ambil foto surat izin atau dokumen pendukung untuk keperluan izin Anda";
    }
    return "Pastikan wajah Anda terlihat jelas dalam frame kamera";
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        hideClose
        className={cn(
          // default mobile fullscreen
          "w-screen h-screen max-w-none rounded-none p-2 flex flex-col justify-around",
          // override di desktop
          "md:max-w-md md:h-auto md:rounded-lg md:p-6"
        )}
      >
        <div className="flex flex-col w-full max-w-sm flex-1 justify-center gap-4 my-auto">
          <DialogHeader className="pl-2 md:p-0">
            <DialogTitle className="flex items-center gap-2">
              <CameraIcon className="h-5 w-5" />
              {getTitle()}
            </DialogTitle>
            <DialogDescription className="flex">
              {getDescription()}
            </DialogDescription>
          </DialogHeader>

          <div
            className="relative aspect-[4/5] bg-muted rounded-lg overflow-hidden"
            style={{ maxHeight: "70vh" }}
          >
            {mode === "preview" ? (
              <>
                <img
                  src={imageUrl}
                  alt="Captured"
                  loading="lazy"
                  className="left-0 right-0 rounded-lg w-full h-full object-cover"
                />
                {/* Preview overlay untuk menunjukkan teks sudah di-burn ke foto */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded">
                  Teks sudah tersimpan di foto
                </div>
              </>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={cn(
                    "w-full h-full object-cover md:rounded-lg",
                    facingMode === "user" && "scale-x-[-1]"
                  )}
                />

                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 pointer-events-none"
                />

                {/* Flip camera button for Sakit/Izin */}
                {isSakitOrIzin && onFlipCamera && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={onFlipCamera}
                    className="absolute top-2 right-2 bg-black/50 border-white/30 text-white hover:bg-black/70 hover:text-white"
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </Button>
                )}

                {isNeedDetected && !isSakitOrIzin && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2">
                    {faceDetected ? (
                      <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full shadow-md">
                        Wajah ditemukan
                      </span>
                    ) : (
                      <span className="bg-red-600 text-white text-xs px-3 py-1 rounded-full shadow-md">
                        Arahkan wajah ke kamera
                      </span>
                    )}
                  </div>
                )}

                <div
                  className="absolute text-white pointer-events-none"
                  style={{
                    bottom: "19px",
                    left: "19px",
                    fontSize: "max(13px, calc(100% / 35))",
                    textShadow: "2px 2px 6px rgba(0, 0, 0, 0.8)",
                    lineHeight: "1.4",
                  }}
                >
                  <div className="space-y-0">
                    <div>{location ? location : "Mendapatkan lokasi..."}</div>
                    <div>{new Date().toLocaleString("id-ID")}</div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {mode === "preview" ? (
              <>
                <Button
                  onClick={onClose}
                  variant="outline"
                  className=" flex-1 text-white hover:text-white bg-blue-600 hover:bg-blue-800"
                >
                  <Check className="w-4 h-4" />
                  Gunakan Foto
                </Button>
                <Button variant="outline" onClick={onRetake}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Ulang
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={onCapture}
                  disabled={!faceDetected && isNeedDetected && !isSakitOrIzin}
                  className="flex-1 bg-honda-red hover:bg-honda-red-dark"
                >
                  <CameraIcon className="w-4 h-4 mr-2" />
                  {isSakitOrIzin ? "Ambil Foto Dokumen" : "Ambil Foto"}
                </Button>
                <Button variant="outline" onClick={onClose}>
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
