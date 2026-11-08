# TRANSITIQ — Smart Bus Tracking and Passenger Information Simulator

**Project Number:** 13  
**Student Roll Number:** 513  
**Project Title:** Smart Bus Tracking and Passenger Information Simulator

Passengers face difficulties identifying suitable bus routes and stops. TRANSITIQ maintains a sample bus network, searches destinations and estimates journey information.

## Mandatory features
- **Bus Registration:** add vehicles, assign routes, record capacity, driver and service status.
- **Route Management:** create routes, add stops in sequence, maintain segment distances and activate/deactivate routes.
- **Route Search:** match boarding and destination stops against ordered route sequences; supports direct and one-transfer options.
- **Journey Estimation:** calculate segment distance, estimated duration and fare; save passenger journey searches.
- **Fare Calculation:** Ordinary, Express and AC fare settings, minimum fare and passenger count.
- **Bus Tracking Simulator:** animated bus markers move along assigned stop coordinates on an OpenStreetMap map. Locations are simulated, not live TSRTC GPS.
- **Admin access:** Supabase email/password authentication and an `admin_users` allowlist protects operational writes.

## Deployment

The GitHub `main` branch is linked to the Vercel project `transitiq-app`. Pushes to `main` trigger Vercel production builds; pull requests receive previews. Supabase URL and publishable key are configured as encrypted Vercel environment variables and are not stored in Git.

## Technology
React 19 · TypeScript · Vite · Supabase Postgres/Auth/RLS · Leaflet · React Leaflet · OpenStreetMap · GitHub · Vercel

## Run locally
1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set your Supabase URL and publishable key.
4. Run `npm run dev`.
5. Verify using `npm run typecheck` and `npm run build`.

## First administrator
Register using Admin sign in, verify your email if required, then open Supabase SQL Editor and run the query below with the same email address:

```sql
insert into public.admin_users(user_id)
select id from auth.users where lower(email)=lower('YOUR_EMAIL_ADDRESS')
on conflict(user_id) do nothing;
```

See [supabase/ADMIN_SETUP.md](supabase/ADMIN_SETUP.md) for details.

## Security
- `.env.local`, `.env`, `.vercel/`, dependencies and build output are excluded from Git.
- The repository contains only placeholder values in `.env.example`.
- Use only the Supabase publishable key in frontend variables. Never expose service-role or secret keys in browser code, Git, or a `VITE_` variable.
- Row Level Security is enabled. Public users can read the network and record a journey search; operational writes require an authenticated admin allowlist member.

Fare rates and sample Hyderabad stops are illustrative academic data, not official transport-agency information.

## India-wide real-data coverage

### Mapped bus stops
- Open **India Stop Explorer**, search any Indian city, town, locality or PIN code, and choose a 2 km, 5 km or 10 km radius.
- The Vercel API geocodes the place with OpenStreetMap Nominatim and queries mapped bus-stop/platform nodes through Overpass.
- An administrator can import the returned mapped stops into Supabase. Each record is labelled `openstreetmap`, retains its OSM source reference, and records ODbL attribution.
- This is geographic discovery, not a guaranteed complete national register: OSM coverage varies by locality and may omit unmapped stops. Search nearby localities to expand an area.

### Actual agency routes
- In the same workspace, an administrator can upload a transport agency's **static GTFS ZIP**.
- Required files: `stops.txt`, `routes.txt`, `trips.txt`, and `stop_times.txt`.
- TRANSITIQ imports stops and distinct route/direction stop patterns into Supabase. These become available to the existing route search and journey estimator.
- GTFS provider terms are retained as provenance; confirm the provider's licence and terms before importing or redistributing a feed.
- This importer uses route patterns to support route matching. It does not yet provide timetable-based next-departure predictions or import every optional GTFS calendar/fare file.

### Live vehicle positions
- Live GPS is **not** generated from static GTFS. It requires an authorized operator vehicle-position feed (commonly GTFS-Realtime VehiclePositions or an operator API) and permission/credentials from that provider.
- Until such a feed is configured, the existing tracking screen's simulated markers must not be represented as real vehicles.

### Attribution and service limits
- Map attribution: © OpenStreetMap contributors, Open Database License (ODbL).
- Public geocoding and Overpass services have fair-use and capacity limits. Avoid automated bulk scraping; search locations as needed and rely on caching.
