# Experience assets

`street-depth.png` is sampled by the WebGL environment shader for vertex
displacement and view-dependent parallax.

The preferred generator is `../scripts/generate-depth-map.py`, which uses the
open-source Depth Anything V2 Small model. Python was unavailable in the
development environment, so the checked-in first pass was produced with
`generate-depth-map-fallback.mjs`: a hand-authored perspective plate matching
the road, horizon, houses, trees, and lamp. Re-run the Python generator when a
Python/model environment is available; it writes to the same path.
