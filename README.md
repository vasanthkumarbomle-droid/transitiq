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
