# Coordinate matching — v1 spec (founder-approved 2026-10-04)

## Decisions

| Topic | Decision |
|---|---|
| Geometry | **City centre ↔ city centre.** Every posting already has origin/destination cities; matching uses those cities' coordinates. |
| User's location | **GPS → nearest city.** Ask location permission once; snap to the nearest city in our list ("You're near Ballari"). Denied/unavailable → user picks a city. Remembered on the device; changeable. |
| GPS privacy | **Raw GPS never leaves the phone.** It is sent only to find the nearest city (an RPC taking lat/lng, which stores nothing). Only the city is kept, on-device. |
| Distance | Straight-line (haversine), shown as **"about X km"** (road is ~20–40 % longer). |
| Radius | **100 km** from the user's city to the posting's pickup city. |
| Destination | **Rank boost only.** Among nearby pickups, postings whose drop is near where the user is headed rank first, tagged **"On your way"**. |
| Who | Truck owner finds loads · shipper finds trucks · broker both · ops desk. |
| Fit labels | Shown on every card, nothing hidden: green **Good fit** · amber **Different truck type** · amber **Truck too small** · grey **Dates don't match**. |
| Fit compared against | **Shipper** (and broker's trucks side): their latest open load. No open load → no labels, distance only. **Truck owner** (and broker's loads side): **no fit labels**, distance only. Ops desk: the explicit load ↔ truck pair. |
| Ordering | Good fits first → then by distance → closed/expired listings greyed at the end. |
| App placement | **Default sort on the browse screens** (Find Loads / Find Trucks / broker Market). Typing a route still works exactly as today. |
| Ops desk | **Both:** a "Suggested pairs" panel (each open load with its closest fitting trucks, one click → match) **and** the existing two lists sorted by distance from the selected load. |
| Coordinates source | **GeoNames India dump (CC BY 4.0)**, matched to our 2,171 cities. Credit line in Profile → About and the dashboard footer: "City locations © GeoNames (CC BY 4.0)". |
| Timing | App + ops desk together, before launch; then a fresh APK and test pass. |

## Fit rules (exact)

For a load L and a truck/availability T:

- **Different truck type** — T's category differs from L's `truck_category_required` (strict: `open` is the open-body truck type, not "any").
- **Truck too small** — T's capacity < L's required capacity (both in tonnes).
- **Dates don't match** — L's loading date is outside T's `available_from … available_till`.
- **Good fit** — none of the above.

If several apply, the card shows the first in the order above (type → size → dates).

## State at the start (2026-10-04)

- `locations.latitude/longitude`: 0 of 2,171 filled at the start. **Filled 2026-10-04: 2,029 of 2,171** from GeoNames, including all 40 cities in use. The 142 left blank (no match, or a same-named town far away) are listed in `docs/geo_unresolved_cities.csv`; a city without coordinates simply gets no distance. "Ballary" was given Ballari's coordinates (duplicate spelling).
- `loads.load_latitude/longitude`, `availabilities.current_latitude/longitude`: unused (0 rows). Not used by v1.
- No PostGIS / earthdistance; v1 uses a plain SQL haversine function.
