import { useState, useEffect } from "react";

export default function useLocation() {
  const [location, setLocation] = useState({ lat: null, lng: null, city: "", state: "", loading: true, error: null });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({ ...prev, loading: false, error: "Geolocation not supported" }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocode to get city/state (using free API)
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          setLocation({
            lat: latitude,
            lng: longitude,
            city: data.city || data.locality || "",
            state: data.principalSubdivision || "",
            loading: false,
            error: null,
          });
        } catch {
          setLocation({ lat: latitude, lng: longitude, city: "", state: "", loading: false, error: null });
        }
      },
      (err) => {
        setLocation((prev) => ({ ...prev, loading: false, error: "Location access denied" }));
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  // Allow manual override
  const setManualLocation = (city, state) => {
    setLocation((prev) => ({ ...prev, city, state, lat: null, lng: null }));
  };

  return { ...location, setManualLocation };
}
