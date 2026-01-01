import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getTanggalSekarang() {
  const now = new Date();

  // Format lokal (tanpa pengaruh UTC)
  const tahun = now.getFullYear();
  const bulan = String(now.getMonth() + 1).padStart(2, "0");
  const tanggalHari = String(now.getDate()).padStart(2, "0");

  const tanggalStartDisplay = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Pastikan format ISO-nya tetap lokal, bukan UTC
  const tanggal = `${tahun}-${bulan}-${tanggalHari}`; // yyyy-MM-dd

  return { tanggalStartDisplay, tanggal };
}
