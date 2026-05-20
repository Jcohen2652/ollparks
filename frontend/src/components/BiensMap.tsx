'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Props {
  geojson: GeoJSON.FeatureCollection;
}

export function BiensMap({ geojson }: Props) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [2.34, 48.86],
      zoom: 11,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('biens', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'biens-circles',
        type: 'circle',
        source: 'biens',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 5,
            16, 14,
          ],
          'circle-color': [
            'case',
            ['get', 'off_market'], '#f59e0b',
            ['get', 'mandat_interne'], '#1e40af',
            '#64748b',
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'biens-circles', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const p = f.properties ?? {};
        new mapboxgl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: sans-serif; min-width:200px;">
              <div style="font-size:11px; color:#64748b; font-family: monospace;">${p.reference ?? ''}</div>
              <div style="font-weight:bold; margin: 4px 0;">${p.adresse ?? ''}</div>
              <div style="font-size:13px;">
                ${p.typologie ?? ''} · ${p.surface_m2 ?? '?'} m²<br/>
                ${p.prix ? `${Number(p.prix).toLocaleString('fr-FR')} €` : ''}
                ${p.loyer_annuel ? `${Number(p.loyer_annuel).toLocaleString('fr-FR')} €/an` : ''}
              </div>
            </div>`,
          )
          .addTo(map);
      });
      map.on('mouseenter', 'biens-circles', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'biens-circles', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [geojson]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-sm">
          ⚠️ <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> manquant dans <code>.env</code>.
          La carte est désactivée. Récupère un token sur{' '}
          <a href="https://account.mapbox.com/access-tokens/" className="text-blue-600 underline">
            account.mapbox.com
          </a>.
        </p>
      </div>
    );
  }

  return <div ref={mapContainer} className="w-full h-[600px] rounded-xl border border-slate-200" />;
}
