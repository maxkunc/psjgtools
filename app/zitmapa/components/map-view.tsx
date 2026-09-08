"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { LocationRow } from "../lib/map-utils";
import { colorForCategory } from "../lib/map-utils";

export interface QuizFeedback {
  guess: { lat: number; lng: number };
  actual: { lat: number; lng: number };
  radiusKm: number;
  correct: boolean;
  name: string;
}

interface Props {
  locations: LocationRow[];
  onSelect?: (loc: LocationRow) => void;
  focusId?: string | null;
  quizMode?: boolean;
  addMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onMove?: (id: string, lat: number, lng: number) => void;
  feedback?: QuizFeedback | null;
  showLabels?: boolean;
}

export default function MapView({ locations, onSelect, focusId, quizMode, addMode, onMapClick, onMove, feedback, showLabels = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const feedbackLayerRef = useRef<L.LayerGroup | null>(null);
  const clickHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);

  const refreshSize = () => {
    const map = mapRef.current;
    if (!map) return;
    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 500);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      worldCopyJump: true,
      zoomControl: true,
      attributionControl: false,
    });
    mapRef.current = map;

    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((r) => r.json())
      .then((geo: FeatureCollection<Geometry>) => {
        const filtered: FeatureCollection<Geometry> = {
          type: "FeatureCollection",
          features: geo.features.filter((f: Feature) => {
            const name = (f.properties?.NAME ?? f.properties?.name ?? "") as string;
            return name !== "Antarctica";
          }),
        };
        L.geoJSON(filtered, {
          style: () => ({
            fillColor: "#ffffff",
            fillOpacity: 1,
            color: "#1f2937",
            weight: 0.6,
            opacity: 1,
          }),
          interactive: false,
        }).addTo(map);
        refreshSize();
      })
      .catch(() => {});


    const resizeMap = () => refreshSize();
    const resizeObserver = new ResizeObserver(() => {
      resizeMap();
    });
    resizeObserver.observe(containerRef.current);
    window.addEventListener("resize", resizeMap);

    refreshSize();
    setTimeout(refreshSize, 120);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    if (quizMode) return;

    const cats = Array.from(new Set(locations.map((l) => l.category).filter(Boolean))) as string[];
    const valid = locations.filter((l) => l.lat !== undefined && l.lng !== undefined);
    const draggable = !!onMove;

    valid.forEach((loc) => {
      const color = colorForCategory(loc.category, cats);
      const icon = L.divIcon({
        className: "",
        html: `<div class="marker-pin" style="background:${color}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([loc.lat!, loc.lng!], { icon, draggable }).addTo(map);
      if (showLabels) {
        marker.bindTooltip(loc.name, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "loc-label",
        });
      }
      const popup = `
        <div style="min-width:200px">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;color:#0f172a">${escapeHtml(loc.name)}</div>
          ${loc.category ? `<div style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:${color};color:white;margin-bottom:6px">${escapeHtml(loc.category)}</div>` : ""}
          ${loc.address ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px">${escapeHtml(loc.address)}</div>` : ""}
          ${loc.description ? `<div style="font-size:12px;color:#334155;margin-top:6px">${escapeHtml(loc.description)}</div>` : ""}
          ${draggable ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;font-style:italic">Tip: značku můžete přetáhnout</div>` : ""}
        </div>`;
      marker.bindPopup(popup);
      marker.on("click", () => onSelect?.(loc));
      if (draggable) {
        marker.on("dragend", (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          onMove?.(loc.id, ll.lat, ll.lng);
        });
      }
      markersRef.current.set(loc.id, marker);
    });

    refreshSize();

    if (valid.length > 0 && !feedback && !focusId) {
      const bounds = L.latLngBounds(valid.map((l) => [l.lat!, l.lng!] as [number, number]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
    }
  }, [locations, onSelect, quizMode, feedback, onMove, showLabels, focusId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clickHandlerRef.current) {
      map.off("click", clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
    const active = (quizMode || addMode) && !!onMapClick;
    if (active) {
      const h = (e: L.LeafletMouseEvent) => onMapClick!(e.latlng.lat, e.latlng.lng);
      clickHandlerRef.current = h;
      map.on("click", h);
      map.getContainer().style.cursor = "crosshair";
    } else {
      map.getContainer().style.cursor = "";
    }
    return () => {
      if (clickHandlerRef.current && mapRef.current) {
        mapRef.current.off("click", clickHandlerRef.current);
        clickHandlerRef.current = null;
      }
    };
  }, [quizMode, addMode, onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (feedbackLayerRef.current) {
      feedbackLayerRef.current.remove();
      feedbackLayerRef.current = null;
    }
    if (!feedback) return;

    const group = L.layerGroup().addTo(map);
    const okColor = "oklch(0.65 0.18 145)";
    const badColor = "oklch(0.6 0.22 25)";
    const color = feedback.correct ? okColor : badColor;

    L.circle([feedback.actual.lat, feedback.actual.lng], {
      radius: feedback.radiusKm * 1000,
      color,
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.1,
      dashArray: "4 4",
    }).addTo(group);

    L.marker([feedback.actual.lat, feedback.actual.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="marker-pin" style="background:${okColor}"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    })
      .addTo(group)
      .bindTooltip(feedback.name, { permanent: true, direction: "top", offset: [0, -14] })
      .openTooltip();

    L.marker([feedback.guess.lat, feedback.guess.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div class="marker-pin" style="background:${color};opacity:0.85"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    }).addTo(group);

    L.polyline(
      [
        [feedback.guess.lat, feedback.guess.lng],
        [feedback.actual.lat, feedback.actual.lng],
      ],
      { color, weight: 1.5, dashArray: "6 4" },
    ).addTo(group);

    feedbackLayerRef.current = group;
    refreshSize();

    const bounds = L.latLngBounds([
      [feedback.guess.lat, feedback.guess.lng],
      [feedback.actual.lat, feedback.actual.lng],
    ]);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 6 });
  }, [feedback]);

  useEffect(() => {
    if (!focusId) return;
    const m = markersRef.current.get(focusId);
    const map = mapRef.current;
    if (m && map) {
      refreshSize();
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 5), { duration: 0.8 });
      m.openPopup();
    }
  }, [focusId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow backdrop-blur">
        Mapa není 100% přesná — pro jistotu zkontrolujte v atlase.
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
