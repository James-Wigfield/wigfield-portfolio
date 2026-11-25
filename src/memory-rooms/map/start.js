/* Where the /memories map opens, and where its "home" button goes back to: ONE constant,
   read by both engines (the Mapbox globe fits `bounds`; the SVG atlas makes them its
   k = 1 view, geo.js WORLD). Change it here to open somewhere else.

   Perth, Western Australia, at metro level: Joondalup down to Rockingham, the coast to the
   hills (so Fremantle, Rockingham and Point Peron are in the first view). */

export const START = {
  name: 'Perth',
  /** [[west, south], [east, north]] in degrees */
  bounds: [
    [115.62, -32.34],
    [116.08, -31.72],
  ],
};

/** The START box's centre, { lat, lng }. */
export const startCentre = () => ({
  lng: (START.bounds[0][0] + START.bounds[1][0]) / 2,
  lat: (START.bounds[0][1] + START.bounds[1][1]) / 2,
});
