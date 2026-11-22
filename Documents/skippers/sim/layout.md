# Palm Beach EAST ramp: sim layout notes

Venue for `/skippers/practical/drive`. Measured 22 Nov 2026 (evening before the practical).
The numbers live in `tools/skippers-sim/layout.mjs`, which writes `public/skippers-sim/venue-layout.json`. The Blender venue script reads that JSON, so the GLB and the physics always agree.

## Which ramp

- **Eastern Palm Beach ramp**, Rockingham. Concrete double-lane ramp with one narrow fixed jetty down the middle and rock revetments on both sides.
- Street View pano `hkJyp6FInXYqglHZyQVZDA` (Jul 2024) stands on the ramp at about -32.27569, 115.71675. In the frame below that is about (-15, -41).
- The ramp and groyne about **100–120 m WEST**, by the Rotary Beach Front toilets and the big trailer car park, is **CLOSED** for renovations. It is modelled fenced off, with orange barriers and a sign (`closed_ramp_west`, `closed_groyne_west`, collider kind `closed_ramp`). Google's "Palm Beach Boat Ramp (West)" pin sits between the two ramps. Don't trust it.

## Frame

Units are metres. X = east, Y = north, Z = up.

- **Origin** = the seaward end (head) of the centre jetty, on its centreline. z = 0 is mean water level. This is about **-32.27532, 115.71691**, worked out from the z21 map centre plus the pixel offset.
- glTF is exported with +Y up, so three.js gets (x, z, -y). Three's -Z points north.
- Ramp-axis helper used in the layout: s = metres along the axis, positive toward the sea, with the head at 0. t = metres across it, positive on the east side.
  `P(s, t) = s·[sin h, cos h] + t·[cos h, −sin h]`, where h = 17°.

## Method

1. **Google Maps satellite** in Chrome, north-up 2D.
   - At z20, the scale bar reads 10 m = 77 CSS px, so 0.130 m per CSS px. Screenshots come back at 1383/1808 of CSS size, so that is 0.170 m per screenshot px.
   - At z21: 5 m = 77 CSS px, so 0.0849 m per screenshot px.
   - At z18: 0.660 m per screenshot px, from the Web Mercator formula 156543·cos(lat)/2^z. It agrees with the bar at the other zooms.
   - Pixel positions were read off the screenshots. They were turned into metres from the map centre given in the URL, then shifted to the jetty head.
2. **Street View** (the pano above, headings 18° and 110°) gave materials, colours and rough heights.
   - The jetty has a green FRP grating deck, dark piles and a row of black posts along its EAST edge. There is a galvanised light pole at the head.
   - The ramp is grey concrete with dark steel grip-mesh pads at the waterline and galvanised kerbs.
   - The rock walls are ochre/brown limestone, with dark weed low down.
   - Looking north you see moored yachts and yellow buoys, Kwinana industry on the NE horizon, and low land to the NW.
   - Looking east (about 120°) there is a cluster of tall Norfolk pines on the Esplanade, and the long Palm Beach jetty beyond.
   - Saved shot: `shots/sv-ramp-looking-nne.png`.
3. The bright, textured patch around the jetty in the satellite image is **shallow clear water over sand and weed**, not rock. Street View shows calm open water there.

## Numbers

| Item | Value | How | Confidence |
|---|---|---|---|
| Ramp/jetty heading (seaward) | **17° true** | jetty line, z20 (17°) and z21 (17.2°); ramp kerbs 16° | ±1.5° |
| Jetty length (head → shore root) | **33 m** | z21: 391 px × 0.0849 | ±2 m |
| Jetty width | **1.7 m** | z21: about 20 px across | ±0.3 m |
| Jetty deck height | **0.8 m** above MWL, level from the head to s = −23, then rising to 1.5 m at the root | Street View estimate | provisional ±0.3 m |
| Ramp width (kerb to kerb) | **11.5 m** | z20 11.3 m, z21 11.5 m (measured square to the axis) | ±0.5 m |
| Each launching lane | **4.9 m** | (11.5 − 1.7) / 2 | ±0.4 m |
| Ramp toe (concrete meets water in the image) | s = **−23 m** | z21, 274 px from the head along the axis | depends on the tide in the image |
| Jetty beyond the toe | about 23 m over open water | as above | |
| Ramp top / turnaround | s ≈ **−62 m**; road at s ≈ −100 | z20 | ±5 m |
| Ramp slope | 0.12 from below water up to s = −40, then 0.03 to the top, giving about 2.7 m at the top | assumed, typical | provisional |
| West rock wall | s −24 → −46, out to t ≈ −18 (about 12 m wide at the sea end) | z21 corners | ±2 m |
| East rock wall | s −22 → −48, out to t ≈ +10…+14 | z21 corners | ±2 m |
| West waterline | (−460,35) (−250,24) (−112,19) (−78,−2) (−40,−17) (−22,−23) | z18 + z21, edge of the sand | ±5 m |
| East waterline | (3,−40) (30,−50) (80,−59) (212,−88) (338,−125) (470,−146) | z18 + z21 | ±5 m |
| Esplanade road centreline | (−470,−40) … (−25,−95) … (300,−152) (480,−178) | z18 | ±5 m |
| Closed west groyne | x ≈ −97…−104, y −20 → +16 | z18 | ±5 m |
| Closed west ramp | x −118…−104, y −24 → +2 | z18; exact lane position is provisional | provisional |
| Palm Beach jetty | root (339,−157) → head (349,−44), about 114 m long, about 3.3 m wide | z18 | ±5 m |
| Nearest moored boats | (36,97) runabout, (17,138), (87,136), (140,49), (172,81) | z18 boat positions | ±5 m (they swing) |
| Moorings in total | 14, all measured off z18, inside x −300…360, y up to about 250 | z18 | |
| Garden Island | 4–13 km to the NW, bearing 311°–345° | known geography | visual only |

Moored boats are static. Bows face about 195–215° (into the SW sea breeze). Yellow buoys are added inside the field.

### Playable water

The playable box is x −300…360, y −160…460. Land is cut out of it by the `shore`, `rock`, `ramp` and `closed_ramp` colliders. All colliders are convex and CCW, and `layout.mjs` checks this.

## Transits (Task 8)

| id | front (low) | back (high) | inbound course | Notes |
|---|---|---|---|---|
| t1 | jetty-head light pole (−0.1,−0.4), h 6 m | big round tree in the park behind the ramp top (−4.4,−96), h about 13 m | **182°**: run in from the moorings | Both are measured positions. The tree height is a guess. |
| t2 | jetty-head light pole | tall Norfolk pine A, the cluster east of the ramp (97,−117), h about 24 m | **140°**: run in from the NW | The pine is measured on z18. Street View confirms the cluster at about 120–130° from the ramp. |
| t3 | Palm Beach jetty head light (349,−44), h about 4.5 m | Norfolk pine B (380,−175), h about 22 m | **166°** | **Provisional**: the pine B position is not measured. |

## Visual-only, not to scale

`garden_island`, `coast_far_north` and `industrial_shore_ne` are placed on their true bearings but pulled in to a radius of about 2.5 km. Their heights are scaled so they keep roughly the right angular size. Set the camera far plane to 3000 m or more.

## Uncertain / provisional

- Jetty deck height, and the profile of the ramp slope.
- Whether the black posts are only on the east edge. Street View only clearly shows the east side.
- The exact lane position of the closed west ramp.
- Transit t3's back pine.
- The heights of all trees.
- The ramp toe depends on the tide when the image was taken. Treat s = −23 as about MWL.
