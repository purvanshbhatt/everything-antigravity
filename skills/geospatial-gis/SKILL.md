---
name: geospatial-gis
description: >-
  Geospatial engineering: coordinate reference systems and axis order,
  PostGIS geometry versus geography with spatial indexes, BigQuery GIS,
  GeoPandas, Shapely and GDAL, file formats (GeoJSON, GeoParquet,
  FlatGeobuf, COG), vector tiles and PMTiles, geocoding with usage limits,
  H3 indexing and web map rendering with MapLibre or Leaflet. Use when
  storing, querying, transforming or displaying location data.
---

# Geospatial and GIS

Every location bug starts with an unstated coordinate system or swapped
longitude and latitude. Store in a known CRS, measure in a CRS (or type) that
uses metres, index everything spatial, and ship maps as tiles instead of giant
GeoJSON files.

## When to use

- Storing points, routes or polygons and querying "near", "within" or "intersects".
- Importing shapefiles, GeoJSON, KML or rasters; reprojecting data.
- Geocoding addresses or reverse geocoding coordinates.
- Rendering maps with many features, or aggregating locations for analytics.

## When not to use

- Routing and vehicle scheduling optimization: use `operations-research`.
- General Postgres tuning: use `postgres-patterns`; warehouse design: `bigquery`.
- Chart dashboards without maps: use `data-visualization`.

## Workflow

1. **Declare the CRS for every dataset.** Store global data as WGS 84 (EPSG:4326). Use Web Mercator (EPSG:3857) only for display tiles. Use a projected CRS (a UTM zone or national grid) or a geography type for distance and area.

   **Check:** Every table, file and API field documents its CRS and axis order.

2. **Fix axis order at the boundaries.** GeoJSON (RFC 7946) and most libraries use `[longitude, latitude]`; many humans and some APIs use latitude first. PostGIS `ST_MakePoint(lon, lat)`, BigQuery `ST_GEOGPOINT(lon, lat)`.

   **Check:** A known landmark round-trips through ingestion, storage and display in the right place.

3. **Model and index in PostGIS.**

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE TABLE stores (
     id   bigint PRIMARY KEY,
     name text NOT NULL,
     geog geography(Point, 4326) NOT NULL
   );
   CREATE INDEX stores_geog_gix ON stores USING gist (geog);

   -- stores within 2 km of a point, nearest first (metres because geography)
   SELECT id, name, ST_Distance(geog, ST_MakePoint(:lon, :lat)::geography) AS m
   FROM stores
   WHERE ST_DWithin(geog, ST_MakePoint(:lon, :lat)::geography, 2000)
   ORDER BY geog <-> ST_MakePoint(:lon, :lat)::geography
   LIMIT 20;
   ```

   Use `geometry` with a projected SRID for heavy polygon operations in one region; `geography` for global distance queries. Validate polygons with `ST_IsValid` and repair with `ST_MakeValid`.

   **Check:** `EXPLAIN` shows the GiST index used for `ST_DWithin`; no query wraps the indexed column in `ST_Transform`.

4. **Use the right tool for files.**

   ```bash
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 out.geojson input.shp
   ogr2ogr -f Parquet out.parquet input.gpkg          # GeoParquet, if your GDAL build supports it
   ogrinfo -so input.gpkg layer_name                   # summary: CRS, extent, fields
   ```

   In Python, use GeoPandas with Shapely 2 and pyproj (`gdf.to_crs(epsg=32633)` before measuring area).

   **Check:** `ogrinfo -so` (or `gdf.crs`) reports the expected CRS after conversion.

5. **Analyze at scale in BigQuery.** `GEOGRAPHY` is spherical WGS 84. Use `ST_GEOGPOINT`, `ST_DWITHIN`, `ST_INTERSECTS`, `ST_CLUSTERDBSCAN`; cluster tables on the geography column; join large point sets to polygons with spatial predicates rather than cross joins. For aggregation, bucket points into H3 or S2 cells.

   **Check:** Query plans show spatial joins, and bytes processed fit the budget.

6. **Geocode within the provider's terms.** Batch and cache only where the terms allow (Google Maps Platform restricts caching; public Nominatim allows at most one request per second and no heavy bulk use, so self-host for volume). Store the provider, accuracy level and timestamp with each result.

   **Check:** Rate limits and terms are documented; low-accuracy results are flagged, not silently used.

7. **Render with tiles.** For more than a few thousand features, serve vector tiles: `ST_AsMVT` from PostGIS, tippecanoe to build tilesets, or PMTiles for a single static file on object storage. Render with MapLibre GL JS, Leaflet (simple raster or small vector), deck.gl (large data layers) or the Google Maps JavaScript API.

   **Check:** The map stays responsive at the target feature count and zoom range on a mid-range phone.

## Reference

### Formats

| Format | Use | Note |
| :--- | :--- | :--- |
| GeoJSON | APIs, small datasets | Always WGS 84, lon/lat; verbose |
| GeoParquet | Analytics, data lakes | Columnar, compressed, works with DuckDB and BigQuery loads |
| FlatGeobuf | Streaming large vector files over HTTP | Spatial index built in |
| GeoPackage | Desktop GIS exchange | SQLite-based, multi-layer |
| Shapefile | Legacy interchange only | 10-character field names, 2 GB limit, many sidecar files |
| Cloud Optimized GeoTIFF | Rasters on object storage | HTTP range reads |
| PMTiles | Static tile archives | One file, no tile server |

### Distance quick facts

One degree of latitude is about 111 km; one degree of longitude shrinks with latitude (about 111 km x cos(latitude)). Never compute distance by Euclidean math on degrees.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Store lat/lng as two floats with no CRS | Geometry or geography column with SRID | Loses indexing, validation and meaning |
| Measure distance in degrees or EPSG:3857 metres | Geography type or a local projected CRS | Mercator metres are inflated away from the equator |
| `ST_Transform(geom, ...)` in a `WHERE` on indexed columns | Store in the query CRS or index an expression | The spatial index is skipped |
| Ship a 50 MB GeoJSON to the browser | Vector tiles or PMTiles | Slow parse, huge memory, frozen UI |
| Bulk geocode against a free public endpoint | Licensed API or self-hosted geocoder | Violates terms and gets blocked |
| Ignore invalid polygons | Validate and repair on ingest | Invalid shapes return wrong intersections silently |

## Verification checklist

- [ ] Every dataset has a documented CRS and axis order.
- [ ] Distance and area use geography types or a suitable projected CRS.
- [ ] Spatial columns are indexed and queries use the index.
- [ ] Geometries are validated on ingest.
- [ ] Geocoding respects provider rate limits and terms; accuracy is stored.
- [ ] Large layers are served as tiles.

## Related

- Knowledge: `postgres-patterns`, `bigquery`, `duckdb-analytics`, `operations-research`, `data-visualization`, `scientific-computing`, `cloud-storage-gcs`.
- Workflows: `/perf-audit`.
- Agents: `database-architect`, `data-engineer`.
