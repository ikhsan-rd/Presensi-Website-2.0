// Google Apps Script API service
import { APPS_SCRIPT_URL } from "@/config/api";
import { useDeviceIdentity } from "@/hooks/useDeviceIdentity";

export interface User {
  id: string;
  nama: string;
  departemen: string;
}

export interface PresensiRecord {
  tanggal: string;
  jam: string;
  presensi: string;
  lokasi: string;
  maps: string;
  foto: string;
}

export interface DashboardData {
  bulan: string;
  dataDiri: {
    id: string;
    nama: string;
    departemen: string;
  };
  records: PresensiRecord[];
  statistik: {
    hadir: number;
    izin: number;
    sakit: number;
    pulang: number;
    terlambat: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  forceLogout?: boolean;
}

// GET requests
export async function cekUser(
  userId: string
): Promise<ApiResponse<{ exists: boolean } & User>> {
  const url = `${APPS_SCRIPT_URL}?action=cekUser&id=${encodeURIComponent(
    userId
  )}`;

  try {
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const text = await response.text();

    // const data = await response.json();
    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("cekUser failed:", error);
    return {
      success: false,
      message: "Gagal mengecek user: " + (error as Error).message,
    };
  }
}

export async function fetchDashboard(
  userId: string,
  uuid: string,
  bulan: string
): Promise<ApiResponse<DashboardData>> {
  const params = new URLSearchParams({
    action: "dashboard",
    id: userId,
    uuid: uuid,
  });

  if (bulan) {
    params.append("bulan", bulan);
  }

  const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: "Gagal mengambil data dashboard: " + (error as Error).message,
    };
  }
}

// POST requests
export async function registerUser(
  userId: string,
  password: string
): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append("action", "register");
  formData.append("id", userId);
  formData.append("password", password);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: "Gagal mendaftar: " + (error as Error).message,
    };
  }
}

export async function loginUser(
  userId: string,
  password: string,
  uuid: string
): Promise<ApiResponse<User>> {
  const formData = new FormData();
  formData.append("action", "login");
  formData.append("id", userId);
  formData.append("password", password);
  formData.append("uuid", uuid);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    if (data.success) {
      try {
        localStorage.setItem("userData", JSON.stringify(data.data));
        localStorage.setItem("is_logged_in", "true");
      } catch (storageError) {
        console.error("Failed to save to localStorage:", storageError);
        return {
          success: false,
          message: "Gagal menyimpan data login",
        };
      }
    }

    return data;
  } catch (error) {
    return {
      success: false,
      message: "Gagal login: " + (error as Error).message,
    };
  }
}

export async function logoutUser(
  userId: string,
  uuid: string
): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append("action", "logout");
  formData.append("id", userId);
  formData.append("uuid", uuid);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    // Backend selalu berhasil, jadi selalu clear session
    clearUserSession();

    return data;
  } catch (error) {
    // Tetap clear session meskipun error
    clearUserSession();
    return {
      success: false,
      message: "Gagal logout: " + (error as Error).message,
    };
  }
}

export async function uploadPhoto(
  id: string,
  tanggal: string,
  presensi: string,
  photoData: string,
  fileName: string
) {
  const formData = new FormData();
  formData.append("action", "uploadPhoto");
  formData.append("id", id);
  formData.append("tanggal", tanggal);
  formData.append("presensi", presensi);
  formData.append("photoData", photoData);
  formData.append("photoFileName", fileName);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    return data as {
      success: boolean;
      message?: string;
      data?: {
        fileId?: string;
        fileUrl?: string;
        folderPath?: string;
        fileName?: string;
      };
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

export async function submitPresensi(presensiData: {
  id: string;
  nama: string;
  departemen: string;
  presensi: string;
  tanggal: string;
  tanggalEnd?: string; // For Sakit/Izin date range
  jam?: string; // Optional for Sakit/Izin
  lokasi: string;
  urlMaps?: string;
  latitude?: number;
  longitude?: number;
  fingerprint?: string;
  uuid?: string;
  photoFileUrl?: string;
}): Promise<ApiResponse> {
  const formData = new FormData();

  formData.append("action", "presensi");
  formData.append("id", presensiData.id);
  formData.append("nama", presensiData.nama);
  formData.append("departemen", presensiData.departemen);
  formData.append("presensi", presensiData.presensi);
  formData.append("tanggal", presensiData.tanggal);
  formData.append("lokasi", presensiData.lokasi);

  // tanggalEnd for Sakit/Izin
  if (presensiData.tanggalEnd) 
    formData.append("tanggalEnd", presensiData.tanggalEnd);
  // jam only for Datang/Pulang
  if (presensiData.jam) 
    formData.append("jam", presensiData.jam);

  if (presensiData.urlMaps) formData.append("urlMaps", presensiData.urlMaps);
  if (presensiData.latitude !== undefined)
    formData.append("latitude", presensiData.latitude.toString());
  if (presensiData.longitude !== undefined)
    formData.append("longitude", presensiData.longitude.toString());
  if (presensiData.fingerprint)
    formData.append("fingerprint", presensiData.fingerprint);
  if (presensiData.uuid) formData.append("uuid", presensiData.uuid);
  if (presensiData.photoFileUrl)
    formData.append("photoFileUrl", presensiData.photoFileUrl);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: "Gagal submit presensi: " + (error as Error).message,
    };
  }
}

// Check session validity
export async function checkSession(
  userId: string,
  uuid: string
): Promise<ApiResponse> {
  const formData = new FormData();
  formData.append("action", "checkSession");
  formData.append("id", userId);
  formData.append("uuid", uuid);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message: "Gagal mengecek sesi: " + (error as Error).message,
    };
  }
}

// Helper functions for login state
export function isLoggedIn(): boolean {
  try {
    return localStorage.getItem("is_logged_in") === "true";
  } catch (error) {
    console.error("Failed to access localStorage:", error);
    return false;
  }
}

export function getCurrentUser(): User | null {
  try {
    const userData = localStorage.getItem("userData");
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error("Failed to get user data:", error);
    return null;
  }
}

export function clearUserSession(): void {
  try {
    localStorage.removeItem("userData");
    localStorage.removeItem("is_logged_in");
    localStorage.removeItem("deviceUUID");
    localStorage.removeItem("isDataChecked");
  } catch (error) {
    console.error("Failed to clear session:", error);
  }
}
