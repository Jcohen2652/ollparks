import { BiensMap } from '@/components/BiensMap';

async function fetchGeo(): Promise<GeoJSON.FeatureCollection> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const res = await fetch(`${base}/biens/geojson`, { cache: 'no-store' });
    if (!res.ok) return { type: 'FeatureCollection', features: [] };
    return await res.json();
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}

export default async function CarteBiensPage() {
  const geojson = await fetchGeo();
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Carte des biens</h1>
      <p className="text-slate-600 mb-6">{geojson.features.length} biens géolocalisés</p>
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500" /> Off-market</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-700" /> Mandat interne</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-500" /> Marché</div>
      </div>
      <BiensMap geojson={geojson} />
    </div>
  );
}
