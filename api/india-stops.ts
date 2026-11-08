// India-wide bus-stop discovery using OpenStreetMap (Nominatim + Overpass).
// Results are mapped locations, not proof of an operator's route or service.
export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const q = String(req.query?.q || "").trim();
  const radius = Math.min(10000, Math.max(1000, Number(req.query?.radius) || 5000));
  if (q.length < 2 || q.length > 100) return res.status(400).json({ error: "Enter a place name between 2 and 100 characters." });

  try {
    const geoUrl = new URL("https://nominatim.openstreetmap.org/search");
    geoUrl.searchParams.set("q", q);
    geoUrl.searchParams.set("countrycodes", "in");
    geoUrl.searchParams.set("format", "jsonv2");
    geoUrl.searchParams.set("addressdetails", "1");
    geoUrl.searchParams.set("limit", "1");
    const geoResponse = await fetch(geoUrl, {
      headers: { "User-Agent": "TRANSITIQ/1.0 (India bus stop discovery; academic project)" }
    });
    if (!geoResponse.ok) throw new Error("Place search is temporarily unavailable. Try again shortly.");
    const geo = await geoResponse.json();
    if (!Array.isArray(geo) || !geo.length) return res.status(404).json({ error: "Place not found in India. Try a city, town, locality or PIN code." });

    const place = geo[0];
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("The place lookup returned invalid coordinates.");

    const query = `[out:json][timeout:25];(node(around:${radius},${lat},${lon})["highway"="bus_stop"];node(around:${radius},${lat},${lon})["public_transport"="platform"]["bus"~"yes|designated"];);out body;`;
    const overpassResponse = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "TRANSITIQ/1.0 (India bus stop discovery; academic project)" },
      body: new URLSearchParams({ data: query }).toString()
    });
    if (!overpassResponse.ok) throw new Error("OpenStreetMap stop data is busy. Please retry in a minute.");
    const payload = await overpassResponse.json();
    const stops = (payload.elements || []).map((el: any) => ({
      source_ref: `node/${el.id}`,
      id: el.id,
      name: el.tags?.name || el.tags?.["name:en"] || el.tags?.ref || "Unnamed bus stop",
      latitude: el.lat,
      longitude: el.lon,
      highway: el.tags?.highway || null,
      public_transport: el.tags?.public_transport || null,
      operator: el.tags?.operator || null,
      shelter: el.tags?.shelter || null
    })).filter((s: any) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({
      place: { name: place.display_name, latitude: lat, longitude: lon },
      radius_m: radius,
      count: stops.length,
      stops,
      source: "© OpenStreetMap contributors",
      license: "Open Database License (ODbL)"
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || "Could not load mapped bus stops right now." });
  }
}
