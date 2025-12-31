import { useState, useCallback } from "react";

export interface LocationData {
  Flatitude: string;
  Flongitude: string;
  Flokasi: string;
  FmapUrl: string;
}

const isMobileDevice = () => {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
};

export const useLocation = () => {
  const [locationData, setLocationData] = useState<LocationData>({
    Flatitude: "0",
    Flongitude: "0",
    Flokasi: "",
    FmapUrl: "",
  });

  const getAddressFromCoordinates = async (
    latitude: number,
    longitude: number
  ): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            "User-Agent": "Presensi-website-triomotor/3.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Reverse geocoding failed");
      }

      const data = await response.json();
      return data.display_name || "Lokasi tidak diketahui";
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return "Gagal mengambil alamat";
    }
  };

  const getLocationAndDecode = useCallback((): Promise<LocationData> => {
    if (!navigator.geolocation) {
      return Promise.reject(
        new Error("Geolocation tidak didukung browser ini")
      );
    }

    const isMobile = isMobileDevice();

    const options: PositionOptions = {
      enableHighAccuracy: isMobile,
      timeout: isMobile ? 15000 : 20000,
      maximumAge: 60000,
    };

    const requestLocation = (
      resolve: (value: LocationData) => void,
      reject: (reason?: any) => void,
      fallback = false
    ) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          const FmapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

          const address = await getAddressFromCoordinates(latitude, longitude);

          const Flokasi =
            accuracy > 300
              ? `⚠ Lokasi mungkin tidak akurat. ${address}`
              : address;

          const result: LocationData = {
            Flatitude: latitude.toString(),
            Flongitude: longitude.toString(),
            Flokasi,
            FmapUrl,
          };

          setLocationData(result);
          resolve(result);
        },
        (error) => {
          if (error.code === error.TIMEOUT && !fallback && isMobile) {
            requestLocation(resolve, reject, true);
            return;
          }

          let message = "Gagal mendapatkan lokasi";
          if (error.code === error.PERMISSION_DENIED) {
            message = "Izin lokasi ditolak";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = "Lokasi tidak tersedia";
          } else if (error.code === error.TIMEOUT) {
            message = "Permintaan lokasi timeout";
          }

          reject(new Error(message));
        },
        fallback
          ? { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
          : options
      );
    };

    return new Promise<LocationData>((resolve, reject) => {
      requestLocation(resolve, reject);
    });
  }, []);

  return {
    locationData,
    setLocationData,
    getLocationAndDecode,
  };
};
