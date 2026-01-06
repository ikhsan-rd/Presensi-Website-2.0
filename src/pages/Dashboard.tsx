import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  checkSession,
  DashboardData,
  fetchDashboard,
  getCurrentUser,
} from "@/services/api";
import { useUser } from "@/contexts/UserContext";
import { useDeviceIdentity } from "@/hooks/useDeviceIdentity";
import {
  ClipboardCheck,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Image,
  MapPin,
  HomeIcon,
  Clock,
  StethoscopeIcon,
  FileText,
  Calendar,
  RefreshCcw,
  LucideEyeOff,
  LucideEye,
} from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NotificationDialog } from "@/components/NotificationDialog";
import { Badge } from "@/components/ui/badge";

import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const Dashboard = () => {
  const navigate = useNavigate();
  const { isLoggingOut, logoutUserGlobal } = useUser();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isShowData, setIsShowData] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const itemsPerPage = 10;

  const currentUser = getCurrentUser();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const { getUUID } = useDeviceIdentity();

  useEffect(() => {
    if (!currentUser) {
      navigate("/presensi");
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/presensi");
      return;
    }

    loadDashboardData();
  }, [selectedMonth, selectedYear]);

  const loadDashboardData = async () => {
    if (!currentUser) return;

    const uuid = getUUID();

    setIsLoading(true);

    const bulan = `${selectedYear}-${String(selectedMonth + 1).padStart(
      2,
      "0"
    )}`;

    console.log("Fetching dashboard for:", bulan, "UUID:", uuid);
    try {
      // 1. Cek session dulu
      const sessionResp = await checkSession(currentUser.id, uuid);

      if (sessionResp.forceLogout || !sessionResp.success) {
        setNotification({
          isOpen: true,
          type: "error",
          title: "Sesi Kadaluarsa",
          message:
            sessionResp.message ||
            "Sesi Anda telah kadaluarsa, silakan login kembali",
          onConfirm: async () => {
            await logoutUserGlobal();
          },
        });
        return;
      }

      // 2. Jika session valid, fetch dashboard
      const response = await fetchDashboard(currentUser.id, uuid, bulan);

      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        setNotification({
          isOpen: true,
          type: "error",
          title: "Error",
          message: response.message || "Gagal mengambil data dashboard",
        });
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
      setNotification({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Terjadi kesalahan saat mengambil data dashboard",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dataDiri = dashboardData?.dataDiri;
  const records = dashboardData?.records || [];

  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date(`${a.tanggal} ${a.jam}`).getTime();
    const dateB = new Date(`${b.tanggal} ${b.jam}`).getTime();
    return dateB - dateA;
  });

  const totalPages = Math.ceil(sortedRecords.length / itemsPerPage);

  const paginatedData = sortedRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (presensi: string) => {
    const status = presensi.toLowerCase();
    switch (status) {
      case "hadir":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Hadir
          </Badge>
        );
      case "pulang":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            Pulang
          </Badge>
        );
      case "izin":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            Izin
          </Badge>
        );
      case "sakit":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            Sakit
          </Badge>
        );
      default:
        return <Badge variant="secondary">{presensi}</Badge>;
    }
  };

  const stats = {
    totalHadir: dashboardData?.statistik.hadir || 0,
    totalTerlambat: dashboardData?.statistik.terlambat || 0,
    totalIzin: dashboardData?.statistik.izin || 0,
    totalSakit: dashboardData?.statistik.sakit || 0,
    totalPulang: dashboardData?.statistik.pulang || 0,
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
    setCurrentPage(1);
  };

  const handleShowData = () => {
    setIsShowData((prev) => !prev);
  };

  const handleLogoutClick = async () => {
    setLogoutDialogOpen(false);
    await logoutUserGlobal();
  };

  return (
    <>
      <LoadingScreen isOpen={isLoggingOut} message="Logout..." />

      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
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

      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <header className="flex flex-col gap-4 mb-6">
            <div className="flex flex-wrap items-center justify-between">
              <div className="">
                <h1 className="text-xl font-bold">Dashboard</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  Riwayat presensi
                </p>
              </div>
              <div className="flex gap-2 md:gap-4">
                <Button
                  onClick={() => navigate("/presensi")}
                  variant="default"
                  size="sm"
                  className="sm:w-28"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="hidden sm:inline">Presensi</span>
                </Button>
                <Button
                  onClick={() => setLogoutDialogOpen(true)}
                  variant="outline"
                  className="md:w-28"
                  disabled={isLoggingOut}
                  size="sm"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </div>
            </div>

            {/* Month Selector */}
            <div className="flex flex-wrap gap-x-2 md:gap-x-4 gap-y-4 items-center justify-between md:justify-start">
              <div className="flex items-center justify-between flex-grow min-w-0">
                <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="hidden sm:block text-sm font-medium text-center">
                  {new Date(selectedYear, selectedMonth).toLocaleDateString(
                    "id-ID",
                    {
                      month: "long",
                      year: "numeric",
                    }
                  )}
                </div>
                <div className="sm:hidden text-sm font-medium text-center">
                  {new Date(selectedYear, selectedMonth).toLocaleDateString(
                    "id-ID",
                    {
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 md:gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:w-28"
                  onClick={handleShowData}
                >
                  {isShowData ? (
                    <LucideEyeOff className="h-4 w-4" />
                  ) : (
                    <>
                      <LucideEye className="h-4 w-4" />
                    </>
                  )}
                  <span className="hidden sm:inline">Detail</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="md:w-28"
                  onClick={loadDashboardData}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      <RefreshCcw className="h-4 w-4" />
                    </>
                  )}
                  <span className="hidden md:inline">Refresh</span>
                </Button>
              </div>
            </div>
          </header>

          {isShowData && (
            <>
              <div className="hidden md:grid md:grid-cols-[25%,auto] gap-2 md:gap-4 mb-6 w-full">
                <Card className="flex flex-col justify-center p-2 text-sm text-muted-foreground">
                  <p>{dataDiri?.id}</p>
                  <p>{dataDiri?.nama}</p>
                  <p>{dataDiri?.departemen}</p>
                </Card>

                <Card
                  className={`flex justify-around gap-4 p-2 ${
                    isLoading ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {/* Hadir */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Calendar className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hadir</p>
                      <p className="text-xl font-bold text-green-600">
                        {stats.totalHadir}
                      </p>
                    </div>
                  </div>

                  {/* Izin */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <FileText className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Izin</p>
                      <p className="text-xl font-bold text-orange-600">
                        {stats.totalIzin}
                      </p>
                    </div>
                  </div>

                  {/* Sakit */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <StethoscopeIcon className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sakit</p>
                      <p className="text-xl font-bold text-purple-600">
                        {stats.totalSakit}
                      </p>
                    </div>
                  </div>

                  {/* Terlambat */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Terlambat</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {stats.totalTerlambat}
                      </p>
                    </div>
                  </div>

                  {/* Pulang */}
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <HomeIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pulang</p>
                      <p className="text-xl font-bold text-blue-600">
                        {stats.totalPulang}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card
                className={`md:hidden text-sm text-muted-foreground mb-6 p-4 w-full ${
                  isLoading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                <div className="flex flex-wrap text-sm text-muted-foreground justify-between sm:justify-start sm:gap-6 pb-2 border-b">
                  <p className="text-sm">{dataDiri?.id}</p>
                  <p className="text-sm">{dataDiri?.nama}</p>
                  <p className="text-sm">{dataDiri?.departemen}</p>
                </div>
                <div className="flex flex-wrap gap-1 sm:gap-3 justify-between pt-2">
                  <div>Hadir : {stats.totalHadir}</div>
                  <div>Sakit : {stats.totalSakit}</div>
                  <div>Izin : {stats.totalIzin}</div>
                  <div>Terlambat : {stats.totalTerlambat}</div>
                  <div>Pulang : {stats.totalPulang}</div>
                </div>
              </Card>
            </>
          )}

          {/* Presensi History */}
          <Card
            className={`p-6 transition ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {/* Desktop View */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[10%,10%,10%,40%,10%,10%] gap-4 pb-2 text-sm font-medium text-muted-foreground border-b mb-4">
                <div>Tanggal</div>
                <div>Status</div>
                <div>Jam</div>
                <div>Lokasi</div>
                <div>Maps</div>
                <div>Foto</div>
              </div>
              <div className="space-y-2 border-b">
                {paginatedData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {isLoading
                      ? "Loading..."
                      : "Tidak ada data presensi untuk bulan ini"}
                  </div>
                ) : (
                  paginatedData.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid text-start grid-cols-[10%,10%,10%,42%,10%,10%] gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="text-sm">
                        {new Date(item.tanggal).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                      <div>{getStatusBadge(item.presensi)}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.jam}
                      </div>
                      <div className="flex flex-col text-sm text-muted-foreground truncate">
                        <span className="truncate">{item.lokasi}</span>
                      </div>
                      <div className="text-sm">
                        {item.maps && (
                          <a
                            href={item.maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            Maps
                          </a>
                        )}
                      </div>
                      <div className="text-sm">
                        {item.foto && (
                          <a
                            href={item.foto}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Image className="h-3 w-3" />
                            Foto
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-2">
              {paginatedData.length === 0 ? (
                <div className="text-center items-center py-8 text-muted-foreground">
                  {isLoading
                    ? "Loading..."
                    : "Tidak ada data presensi untuk bulan ini"}
                </div>
              ) : (
                paginatedData.map((item, idx) => (
                  <div key={idx} className="px-2 pb-3 border-b space-y-2">
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                      <div className="flex flex-wrap gap-3 items-center">
                        <div className="text-sm">
                          {new Date(item.tanggal).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </div>
                        <span className="text-sm hidden sm:block">-</span>
                        <span className="text-sm">{item.jam}</span>
                      </div>
                      {getStatusBadge(item.presensi)}
                    </div>
                    <div className="flex gap-2 sm:gap-3 flex-wrap sm:flex-nowrap text-sm">
                      <span className="text-muted-foreground truncate">
                        {item.lokasi}
                      </span>
                      {item.maps && (
                        <a
                          href={item.maps}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" />
                          Maps
                        </a>
                      )}
                      {item.foto && (
                        <a
                          href={item.foto}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <Image className="h-3 w-3" />
                          Foto
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6">
                <div className="text-sm text-muted-foreground">
                  Hal<span className="hidden sm:inline">aman</span>{" "}
                  {currentPage} dari {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
function clearUUID() {
  throw new Error("Function not implemented.");
}
