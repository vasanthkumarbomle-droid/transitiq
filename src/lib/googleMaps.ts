let googleMapsPromise: Promise<any> | null = null;

export function getGoogleMapsApiKey(): string {
  return (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
}

export async function loadGoogleMaps(): Promise<any> {
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error("Google Maps is not configured yet. Add VITE_GOOGLE_MAPS_API_KEY to Vercel.");

  const browser = window as any;
  if (browser.google?.maps?.importLibrary) return browser.google.maps;

  if (!googleMapsPromise) {
    googleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-transitiq-google-maps="true"]');
      const finish = () => {
        const maps = (window as any).google?.maps;
        if (maps?.importLibrary) resolve(maps);
        else reject(new Error("Google Maps loaded, but the Maps JavaScript API was not initialized. Check enabled APIs and key restrictions."));
      };

      if (existing) {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps could not be loaded.")), { once: true });
        if ((window as any).google?.maps?.importLibrary) finish();
        return;
      }

      const script = document.createElement("script");
      script.dataset.transitiqGoogleMaps = "true";
      script.async = true;
      script.defer = true;
      script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly&loading=async";
      script.onload = finish;
      script.onerror = () => reject(new Error("Google Maps could not be loaded. Check the browser API key, billing and Maps JavaScript API access."));
      document.head.appendChild(script);
    }).catch(error => {
      googleMapsPromise = null;
      throw error;
    });
  }
  return googleMapsPromise;
}
