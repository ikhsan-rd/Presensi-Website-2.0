import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format ISO date (yyyy-MM-dd) → d/mmm/yyyy
 * contoh: 2026-01-03 → 3/Jan/2026
 */
export function formatTanggalDisplay(dateISO?: string) {
  if (!dateISO) return "";

  const date = new Date(`${dateISO}T00:00:00`); // paksa lokal
  return date
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/ /g, " ");
}

/**
 * Ambil tanggal hari ini (lokal)
 */
export function getTanggalSekarang() {
  const now = new Date();

  const tahun = now.getFullYear();
  const bulan = String(now.getMonth() + 1).padStart(2, "0");
  const tanggalHari = String(now.getDate()).padStart(2, "0");

  const tanggalStart = `${tahun}-${bulan}-${tanggalHari}`; // yyyy-MM-dd

  return {
    tanggalStart,
    tanggalStartDisplay: formatTanggalDisplay(tanggalStart),
  };
}

export function getJamSekarang() {
  return new Date().toLocaleTimeString("en-GB", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
