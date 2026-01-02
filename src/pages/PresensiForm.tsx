import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  isLoggedIn as checkIsLoggedIn,
  getCurrentUser,
  submitPresensi,
  uploadPhoto,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Camera as CameraIcon,
  RefreshCw,
  Eye,
  LogIn,
  Home,
  LogOut,
  CalendarSearch,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/LoadingScreen";
import { LoginModal } from "@/components/LoginModal";
import { CameraModal } from "@/components/CameraModal";
import { NotificationDialog } from "@/components/NotificationDialog";
import { useCamera } from "@/hooks/useCamera";
import { useLocation } from "@/hooks/useLocation";
import { useUserData } from "@/hooks/useUserData";
import { useUser } from "@/contexts/UserContext";
import { useDeviceIdentity } from "@/hooks/useDeviceIdentity";
import {
  getTanggalSekarang,
  formatTanggalDisplay,
  getJamSekarang,
} from "@/lib/utils";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/hooks/use-toast";

export const PresensiForm = () => {
  const [formData, setFormData] = useState({
    id: "",
    nama: "",
    departemen: "",
    ...getTanggalSekarang(),
    tanggalEnd: "", // For Sakit/Izin date range
    tanggalEndDisplay: "", // For display
    jam: getJamSekarang(),
    presensi: "",
    longitude: "",
    latitude: "",
    lokasi: "",
    urlMaps: "",
    uuid: "",
    fingerprint: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isNeedDetected, setIsNeedDetected] = useState(false);

  const [lockedWaktu, setLockedWaktu] = useState<string | null>(null);
  const [lockedTanggal, setLockedTanggal] = useState<string | null>(null);
  const [lockedTanggalEnd, setLockedTanggalEnd] = useState<string | null>(null);
  const [isDataLocked, setIsDataLocked] = useState(false);

  const [openStartDate, setOpenStartDate] = useState(false);
  const [openEndDate, setOpenEndDate] = useState(false);

  const [tanggalListCheck, setTanggalListCheck] = useState<
    { date: string; checked: boolean }[]
  >([]);

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const navigate = useNavigate();

  const isSakitOrIzin =
    formData.presensi === "Sakit" || formData.presensi === "Izin";

  const {
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
  } = useCamera(
    {
      location: formData.lokasi,
      tanggalDisplay: formData.tanggalStartDisplay,
      tanggalEndDisplay: formData.tanggalEndDisplay,
      jam: formData.jam,
      presensiType: formData.presensi,
    },
    isSakitOrIzin
  );

  const { getLocationAndDecode } = useLocation();
  const { getDeviceIdentity } = useDeviceIdentity();
  const {
    isChecking,
    setIsChecking,
    isIdChecked,
    setIsIdChecked,
    idNeedsRecheck,
    setIdNeedsRecheck,
    fetchUserData,
  } = useUserData();

  const {
    userData,
    setIsDataChecked: setGlobalDataChecked,
    clearUserData,
    logoutUserGlobal,
    isLoggingOut,
  } = useUser();

  const lockTanggalWaktu = (waktu: string) => {
    setLockedWaktu(waktu);
    setLockedTanggal(formData.tanggalStart);
    setLockedTanggalEnd(formData.tanggalEnd || null);
    setIsDataLocked(true);
  };

  const unlockTanggalWaktu = () => {
    setLockedWaktu(null);
    setLockedTanggal(null);
    setLockedTanggalEnd(null);
    setIsDataLocked(false);
  };

  const normalizeJam = (jam: string) => {
    // ambil HH:mm:ss saja kalau ada spasi / T
    if (jam.includes(" ")) return jam.split(" ")[1];
    if (jam.includes("T")) return jam.split("T")[1].slice(0, 8);
    return jam;
  };

  useEffect(() => {
    if (formData.presensi !== "Sakit" && formData.presensi !== "Izin") return;

    if (!formData.tanggalStart || !formData.tanggalEnd) return;

    const start = new Date(formData.tanggalStart);
    const end = new Date(formData.tanggalEnd);

    const list: { date: string; checked: boolean }[] = [];
    let current = new Date(start);

    while (current <= end) {
      const iso = [
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, "0"),
        String(current.getDate()).padStart(2, "0"),
      ].join("-");

      list.push({ date: iso, checked: true });
      current.setDate(current.getDate() + 1);
    }

    setTanggalListCheck(list);
  }, [formData.presensi, formData.tanggalStart, formData.tanggalEnd]);

  // Real-time clock update - only when not locked
  useEffect(() => {
    if (isDataLocked) return; // Don't update when photo is captured

    const interval = setInterval(() => {
      setFormData((prev) => ({
        ...prev,
        jam: getJamSekarang(),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isDataLocked]);

  // Check login status on component mount and load ID from localStorage
  useEffect(() => {
    setIsLoggedIn(checkIsLoggedIn());
    setCurrentUser(getCurrentUser());

    // Jika user sudah login, isi ID saja dari localStorage
    if (userData) {
      setFormData((prev) => ({
        ...prev,
        id: userData.id,
      }));
    }
  }, [userData]);

  // Auto-set date
  useEffect(() => {
    const { tanggalStartDisplay, tanggalStart } = getTanggalSekarang();
    setFormData((prev) => ({
      ...prev,
      tanggalStartDisplay,
      tanggalStart,
    }));
  }, []);

  // Handle ID changes - mark as needing recheck
  const handleIdChange = (value: string) => {
    setFormData({ ...formData, id: value, nama: "", departemen: "" });
    setIsIdChecked(false);
    setIdNeedsRecheck(true);
  };

  const handleCheck = async () => {
    if (!formData.id.trim()) return;

    setIsChecking(true);

    // console.log(formData.id);

    try {
      // 1. Fetch user data
      setLoadingMessage("Mendapatkan data");
      const userData = await fetchUserData(formData.id.trim());

      if (!userData) {
        setNotification({
          isOpen: true,
          type: "error",
          title: "ID Tidak Ditemukan",
          message:
            "ID tidak ditemukan dalam database. Pastikan ID yang dimasukkan benar.",
        });
        setIsChecking(false);
        return;
      }

      // 2. Get location
      setLoadingMessage("Mendapatkan lokasi");
      const locationResult = await getLocationAndDecode();

      // 3. Generate unique code
      const deviceIdentity = await getDeviceIdentity();

      // 4. Update form data
      setFormData((prev) => ({
        ...prev,
        id: userData.id,
        nama: userData.nama,
        departemen: userData.departemen,
        uuid: deviceIdentity.uuid,
        fingerprint: deviceIdentity.fingerprint,
        latitude: locationResult.Flatitude,
        longitude: locationResult.Flongitude,
        lokasi: locationResult.Flokasi,
        urlMaps: locationResult.FmapUrl,
      }));

      setIsIdChecked(true);
      setIdNeedsRecheck(false);

      // Simpan juga ke global state
      setGlobalDataChecked(true);

      setNotification({
        isOpen: true,
        type: "success",
        title: "Data Berhasil Diambil",
        message: "Data pengguna dan lokasi berhasil diperoleh.",
      });
    } catch (error) {
      console.error("Check failed:", error);
      let errorMessage = "Gagal mengambil data";
      if (error instanceof Error) {
        if (error.message.includes("Location")) {
          errorMessage = `Gagal mendapatkan lokasi: ${error.message}`;
        } else if (error.message.includes("fetch")) {
          errorMessage = "Gagal mengakses server. Periksa koneksi internet.";
        } else {
          errorMessage = error.message;
        }
      }
      setNotification({
        isOpen: true,
        type: "error",
        title: "Gagal Mengambil Data",
        message: errorMessage,
      });
    } finally {
      setIsChecking(false);
      setLoadingMessage("");
    }
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;

    setIsLoading(true);
    try {
      setLoadingMessage("Mengirim Data...");

      const tempFileName = "temp.jpg"; // Placeholder, will be replaced in uploadPhoto

      // 1. Submit presensi + sertakan photoFileId
      const isSakitIzin =
        formData.presensi === "Sakit" || formData.presensi === "Izin";

      // Use locked data if available, otherwise use current form data
      const submitTanggal = lockedTanggal || formData.tanggalStart;
      const submitJam = normalizeJam(lockedWaktu || formData.jam);
      const tanggalList = isSakitIzin
        ? tanggalListCheck.filter((d) => d.checked).map((d) => d.date)
        : undefined;

      const response = await submitPresensi({
        id: formData.id,
        nama: formData.nama,
        departemen: formData.departemen,
        presensi: formData.presensi,
        tanggalStart: submitTanggal,
        tanggalList: isSakitIzin
          ? tanggalListCheck.filter((d) => d.checked).map((d) => d.date)
          : undefined,
        jam: isSakitIzin ? undefined : submitJam, // Jam not needed for Sakit/Izin
        lokasi: formData.lokasi,
        urlMaps: formData.urlMaps,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude
          ? parseFloat(formData.longitude)
          : undefined,
        fingerprint: formData.fingerprint,
        uuid: formData.uuid, // Include UUID in submission
        photoFileUrl: tempFileName,
      });

      if (!response.success) {
        setNotification({
          isOpen: true,
          type: "error",
          title: "Presensi Gagal",
          message: response.message || "Data presensi gagal disimpan",
        });
        return;
      }

      // 1. Upload foto
      const fileName = `${formData.id}-${formData.tanggalStartDisplay}-${formData.presensi}.jpg`;

      setLoadingMessage("Upload Foto...");
      const uploadRes = await uploadPhoto(
        formData.id,
        formData.tanggalStart,
        formData.presensi,
        capturedImage,
        fileName
      );

      if (!uploadRes?.success) {
        setNotification({
          isOpen: true,
          type: "error",
          title: "Upload Gagal",
          message: uploadRes?.message || "Foto gagal diupload",
        });
        return; // stop proses
      }

      // 3. Notifikasi
      setNotification({
        isOpen: true,
        type: "success",
        title: "Presensi Berhasil",
        message: "Data presensi dan foto berhasil disimpan!",
      });

      setFormData({
        id: "",
        nama: "",
        departemen: "",
        ...getTanggalSekarang(),
        tanggalEnd: "",
        tanggalEndDisplay: "",
        jam: getJamSekarang(),
        presensi: "",
        longitude: "",
        latitude: "",
        lokasi: "",
        urlMaps: "",
        uuid: "",
        fingerprint: "",
      });

      retakePhoto();
      unlockTanggalWaktu(); // Unlock data after successful submit
      setIsIdChecked(false);
      setIdNeedsRecheck(false);
    } catch (error) {
      console.error("Gagal submit:", error);
      setNotification({
        isOpen: true,
        type: "error",
        title: "Gagal Submit",
        message: "Terjadi kesalahan saat mengirim data",
      });
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  // Validation logic
  const isFormValid = () => {
    if (!isIdChecked) return false;

    if (!formData.presensi || formData.presensi.trim() === "") {
      return false;
    }

    if (!formData.lokasi || !formData.uuid || !formData.fingerprint) {
      return false;
    }

    if (isSakitOrIzin) {
      const aktif = tanggalListCheck.filter((d) => d.checked);
      if (aktif.length === 0) return false;
    }

    if (
      (formData.presensi === "Sakit" || formData.presensi === "Izin") &&
      !formData.tanggalEnd
    ) {
      return false;
    }

    return true;
  };

  const isCameraEnabled = () => isFormValid();
  const isSubmitEnabled = () => isFormValid() && capturedImage;

  const handleLogoutClick = async () => {
    setLogoutDialogOpen(false);
    await logoutUserGlobal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/50 to-background p-4 relative">
      {/* Loading Screen */}
      <LoadingScreen
        isOpen={isChecking || isLoading || isLoggingOut}
        message={isLoggingOut ? "Logout..." : loadingMessage}
      />

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-4">
          <div
            className="relative overflow-hidden rounded-xl p-14 text-center text-white shadow-xl
                  bg-[url('/bg.png')] bg-cover bg-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-honda-red/40 to-honda-red-dark/70"></div>

            <div className="relative z-10">
              <h1 className="text-3xl font-bold tracking-wide">
                Form Presensi
              </h1>
              <p className="mt-2 text-honda-silver">
                TRIO MOTOR - Honda Authorized Dealer
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-2xl">
          <div className="p-8 space-y-6">
            {/* ID Field */}
            <div className="space-y-2">
              <div className="flex justify-end">
                {isLoggedIn ? (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      onClick={() => navigate("/")}
                      size="sm"
                    >
                      <Home className="h-4 w-4" />
                      <span className="inline">Dashboard</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setLogoutDialogOpen(true)}
                      disabled={isLoggingOut}
                      size="sm"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="hidden sm:inline">Logout</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setLoginModalOpen(true)}
                    size="sm"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Button>
                )}
              </div>
            </div>

            <div className="h-px w-full bg-red-700"></div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">ID</label>
              <div className="flex gap-3">
                <Input
                  value={formData.id}
                  onChange={(e) => handleIdChange(e.target.value)}
                  placeholder="Masukkan ID"
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleCheck}
                  disabled={isChecking || !formData.id.trim() || isLoading}
                  variant={
                    isLoading || isChecking || !formData.id.trim()
                      ? "outline"
                      : isIdChecked
                      ? "default"
                      : "outline"
                  }
                  className={`px-6
                    ${
                      isLoading || isChecking || !formData.id.trim()
                        ? "px-6 text-red-600 border-red-600"
                        : isIdChecked
                        ? "px-6"
                        : "px-6 text-red-600 border-red-600"
                    }`}
                >
                  {isChecking
                    ? "..."
                    : isIdChecked && !idNeedsRecheck
                    ? "Re-cek"
                    : "Cek"}
                </Button>
              </div>
            </div>

            {/* Nama */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Nama
              </label>
              <Input
                value={formData.nama || "Belum terisi"}
                readOnly
                className={cn(
                  "bg-muted",
                  !formData.nama && "text-muted-foreground"
                )}
              />
            </div>

            {/* Departemen */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Departemen
              </label>
              <Input
                value={formData.departemen || "Belum terisi"}
                readOnly
                className={cn(
                  "bg-muted",
                  !formData.departemen && "text-muted-foreground"
                )}
              />
            </div>

            {/* Hidden Location for Development - Remove for Production */}

            {/* Hidden inputs for submission */}
            <input type="hidden" value={formData.uuid} />
            <input type="hidden" value={formData.fingerprint} />
            <input type="hidden" value={formData.urlMaps} />
            <input type="hidden" value={formData.latitude} />
            <input type="hidden" value={formData.longitude} />

            {/* Tanggal & Jam */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formData.presensi === "Sakit" || formData.presensi === "Izin"
                    ? "Tanggal Mulai"
                    : "Tanggal"}
                </label>

                {/* actual date picker (hidden) */}
                {isSakitOrIzin ? (
                  <Popover open={openStartDate} onOpenChange={setOpenStartDate}>
                    <PopoverTrigger asChild>
                      <div className="relative flex items-center">
                        <Input
                          value={formData.tanggalStartDisplay}
                          readOnly
                          className="pr-10"
                          disabled={
                            !isIdChecked || idNeedsRecheck || isDataLocked
                          }
                        />
                        <CalendarSearch className="absolute right-2 w-5 h-5 text-gray-500" />
                      </div>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          formData.tanggalStart
                            ? new Date(`${formData.tanggalStart}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;

                          const iso = [
                            date.getFullYear(),
                            String(date.getMonth() + 1).padStart(2, "0"),
                            String(date.getDate()).padStart(2, "0"),
                          ].join("-");

                          setFormData((prev) => {
                            const shouldSyncEndDate =
                              !prev.tanggalEnd || prev.tanggalEnd < iso;

                            return {
                              ...prev,
                              tanggalStart: iso,
                              tanggalStartDisplay: formatTanggalDisplay(iso),
                              tanggalEnd: shouldSyncEndDate
                                ? iso
                                : prev.tanggalEnd,
                              tanggalEndDisplay: shouldSyncEndDate
                                ? formatTanggalDisplay(iso)
                                : prev.tanggalEndDisplay,
                            };
                          });

                          setOpenStartDate(false);
                        }}
                        disabled={(date) =>
                          date < new Date(getTanggalSekarang().tanggalStart)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Input
                    value={formData.tanggalStartDisplay}
                    readOnly
                    disabled={!isIdChecked || idNeedsRecheck}
                    className="bg-muted"
                  />
                )}
              </div>

              {/* Tanggal Selesai - Only for Sakit/Izin */}
              {isSakitOrIzin ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Tanggal Selesai
                  </label>

                  <Popover open={openEndDate} onOpenChange={setOpenEndDate}>
                    <PopoverTrigger asChild>
                      <div className="relative flex items-center">
                        <Input
                          value={formData.tanggalEndDisplay}
                          readOnly
                          className="pr-10"
                          disabled={
                            !isIdChecked || idNeedsRecheck || isDataLocked
                          }
                        />
                        <CalendarSearch className="absolute right-2 w-5 h-5 text-gray-500" />
                      </div>
                    </PopoverTrigger>

                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={
                          formData.tanggalEnd
                            ? new Date(`${formData.tanggalEnd}T00:00:00`)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (!date) return;

                          const iso = [
                            date.getFullYear(),
                            String(date.getMonth() + 1).padStart(2, "0"),
                            String(date.getDate()).padStart(2, "0"),
                          ].join("-");

                          setFormData((prev) => ({
                            ...prev,
                            tanggalEnd: iso,
                            tanggalEndDisplay: formatTanggalDisplay(iso),
                          }));

                          // auto close
                          setOpenEndDate(false);
                        }}
                        disabled={(date) =>
                          date < new Date(`${formData.tanggalStart}T00:00:00`)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                /* Jam tetap */
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Jam
                  </label>
                  <Input
                    value={formData.jam}
                    readOnly
                    disabled={!isIdChecked || idNeedsRecheck}
                    className="bg-muted"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {isSakitOrIzin && tanggalListCheck.length > 0 && (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Hanya hari kerja</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {tanggalListCheck.map((item, idx) => (
                      <label
                        key={item.date}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => {
                            setTanggalListCheck((prev) =>
                              prev.map((d, i) =>
                                i === idx ? { ...d, checked: !d.checked } : d
                              )
                            );
                          }}
                          disabled={
                            !isIdChecked || idNeedsRecheck || isDataLocked
                          }
                        />
                        {formatTanggalDisplay(item.date)}
                      </label>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      * Uncheck yang bukan hari kerja seperti libur, cuti dan
                      off-shift
                    </p>
                    {isDataLocked && (
                      <p className="text-xs text-muted-foreground">
                        * Hapus Foto untuk mengubah tanggal
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Duration info tetap */}
              {formData.tanggalStart &&
                formData.tanggalEnd &&
                (() => {
                  const start = new Date(formData.tanggalStart);
                  const end = new Date(formData.tanggalEnd);
                  const diffDays =
                    Math.floor(
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
                    ) + 1;

                  return diffDays > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Durasi:{" "}
                      <span className="font-medium text-primary">
                        {diffDays} hari
                      </span>
                    </p>
                  ) : null;
                })()}
            </div>

            {/* Waktu Radio */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Keterangan
              </Label>
              <RadioGroup
                value={formData.presensi}
                onValueChange={(value) => {
                  const prevValue = formData.presensi;
                  const prevIsSakitIzin =
                    prevValue === "Sakit" || prevValue === "Izin";
                  const newIsSakitIzin = value === "Sakit" || value === "Izin";

                  const isGroupChange =
                    prevValue && prevIsSakitIzin !== newIsSakitIzin;

                  if (isGroupChange && capturedImage) {
                    retakePhoto();
                    unlockTanggalWaktu();
                    setNotification({
                      isOpen: true,
                      type: "error",
                      title: "Foto dihapus",
                      message: "Terjadi perubahan keterangan, ambil ulang foto",
                    });
                  }

                  // ⬇️ RESET START DATE KE TODAY JIKA KEMBALI KE DATANG / PULANG
                  const today = getTanggalSekarang();

                  setFormData((prev) => ({
                    ...prev,
                    presensi: value,

                    // jika keluar dari sakit/izin → reset tanggal ke today
                    tanggalStart: newIsSakitIzin
                      ? prev.tanggalStart
                      : today.tanggalStart,
                    tanggalStartDisplay: newIsSakitIzin
                      ? prev.tanggalStartDisplay
                      : today.tanggalStartDisplay,

                    // end date hanya valid untuk sakit/izin
                    tanggalEnd: newIsSakitIzin
                      ? prev.tanggalEnd || today.tanggalStart
                      : "",
                    tanggalEndDisplay: newIsSakitIzin
                      ? formatTanggalDisplay(
                          prev.tanggalStart || today.tanggalStart
                        )
                      : "",
                  }));

                  setIsNeedDetected(value === "Hadir" || value === "Pulang");
                }}
                className="grid grid-cols-1 md:grid-cols-2 items-center justify-around"
                disabled={isLoading || !isIdChecked || idNeedsRecheck}
              >
                {/* <div className="flex items-center justify-around "> */}
                <div className="grid items-center grid-cols-2 md:flex md:justify-around">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="Hadir"
                      id="datang"
                      disabled={!isIdChecked || idNeedsRecheck}
                    />
                    <Label
                      htmlFor="datang"
                      className={cn(
                        !isIdChecked || idNeedsRecheck
                          ? "text-muted-foreground"
                          : ""
                      )}
                    >
                      Datang
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="Pulang"
                      id="pulang"
                      disabled={!isIdChecked || idNeedsRecheck}
                    />
                    <Label
                      htmlFor="pulang"
                      className={cn(
                        !isIdChecked || idNeedsRecheck
                          ? "text-muted-foreground"
                          : ""
                      )}
                    >
                      Pulang
                    </Label>
                  </div>
                </div>

                {/* <div className="flex items-center justify-around"> */}
                <div className="grid items-center grid-cols-2 md:flex md:justify-around">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="Sakit"
                      id="sakit"
                      disabled={!isIdChecked || idNeedsRecheck}
                    />
                    <Label
                      htmlFor="sakit"
                      className={cn(
                        !isIdChecked || idNeedsRecheck
                          ? "text-muted-foreground"
                          : ""
                      )}
                    >
                      Sakit
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="Izin"
                      id="izin"
                      disabled={!isIdChecked || idNeedsRecheck}
                    />
                    <Label
                      htmlFor="izin"
                      className={cn(
                        !isIdChecked || idNeedsRecheck
                          ? "text-muted-foreground"
                          : ""
                      )}
                    >
                      Izin
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {/* Camera Section */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Foto
              </label>

              <div className="flex gap-2">
                <Button
                  onClick={() => setCameraModalOpen(true)}
                  variant="outline"
                  className="w-full py-6 border-dashed border-2"
                  disabled={!isCameraEnabled() || isLoading}
                >
                  {capturedImage ? (
                    <>
                      <CameraIcon className="mr-2 h-5 w-5" />
                      Lihat Foto
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-5 w-5" />
                      {!isIdChecked ? "Cek ID Terlebih Dahulu" : "Buka Kamera"}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="h-px w-full bg-red-700"></div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              className="w-full py-6 text-lg font-medium bg-honda-red hover:bg-honda-red-dark shadow-lg disabled:opacity-50"
              disabled={!isSubmitEnabled() || isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </Card>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        videoRef={videoRef}
        canvasRef={canvasRef}
        faceDetected={faceDetected}
        isNeedDetected={isNeedDetected}
        onCapture={capturePhoto}
        onLock={() => lockTanggalWaktu(formData.jam)}
        onUnlock={unlockTanggalWaktu}
        location={formData.lokasi}
        tanggalStartDisplay={formData.tanggalStartDisplay}
        tanggalEndDisplay={isSakitOrIzin ? formData.tanggalEndDisplay : ""}
        waktuLengkap={formData.jam || ""}
        imageUrl={capturedImage || ""}
        onRetake={retakePhoto}
        mode={mode}
        presensiType={formData.presensi}
        facingMode={facingMode}
        onFlipCamera={flipCamera}
      />

      {/* Notification Modal */}
      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={() => setNotification((prev) => ({ ...prev, isOpen: false }))}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />

      {/* Confirm Modal */}
      <ConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="Konfirmasi Logout"
        description="Apakah Anda yakin ingin keluar dari sistem?"
        confirmText="Ya, Logout"
        cancelText="Batal"
        onConfirm={handleLogoutClick}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={() => {
          setIsLoggedIn(true);
          setCurrentUser(getCurrentUser());
        }}
      />
    </div>
  );
};
