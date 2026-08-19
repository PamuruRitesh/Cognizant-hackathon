import { useEffect, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { API_BASE } from '../config'
import ErrorState from './ErrorState'
import SkeletonLoader from './SkeletonLoader'
import { ComposableMap, Geographies, Geography, Marker, Graticule } from 'react-simple-maps'

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Real geographic center coordinates [lon, lat]
const COUNTRY_COORDS = {
  BR: [-51.9, -14.2],
  US: [-98.5,  39.8],
  IN: [ 78.9,  22.9],
  CN: [104.2,  35.9],
  GB: [ -3.4,  55.4],
  DE: [ 10.4,  51.2],
  FR: [  2.2,  46.2],
  AU: [133.8, -25.3],
  JP: [138.2,  36.2],
  CA: [-106.3,  56.1],
  MX: [-102.5,  23.6],
  RU: [  37.6,  55.7],
  ZA: [  25.0, -29.0],
  NG: [   8.7,   9.1],
  AR: [ -63.6, -38.4],
  ID: [ 113.9,  -0.8],
  SA: [  45.1,  23.9],
}

const LocationsGraph = ({ refreshKey = 0, searchQuery = '', riskFilter = 'all', selectedDate = '', onViewSKU }) => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/risk?limit=100${selectedDate && selectedDate !== 'all' ? `&date=${selectedDate}` : ''}`)
      .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
      .then(json => { setRows(json.grid || []); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [refreshKey, selectedDate])

  const locations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const grouped = new Map()
    rows.forEach(row => {
      const score = Number(row.risk_score || 0)
      const level = score > 0.9 ? 'high' : score > 0.45 ? 'med' : 'low'
      if (riskFilter !== 'all' && level !== riskFilter) return
      if (q && !`${row.store_id} ${row.product_id}`.toLowerCase().includes(q)) return
      const cur = grouped.get(row.store_id) || {
        store_id: row.store_id, count: 0, high: 0, maxRisk: 0,
        minDays: Infinity, topProduct: row.product_id,
      }
      cur.count += 1
      cur.high += level === 'high' ? 1 : 0
      if (score >= cur.maxRisk) { cur.maxRisk = score; cur.topProduct = row.product_id }
      cur.minDays = Math.min(cur.minDays, Number(row.days_to_stockout ?? Infinity))
      grouped.set(row.store_id, cur)
    })
    
    return Array.from(grouped.values())
      .sort((a, b) => b.maxRisk - a.maxRisk)
      .slice(0, 12)
      .map((loc, i, list) => {
        const country = String(loc.store_id || '').split('-').pop()?.toUpperCase()
        const coords = COUNTRY_COORDS[country]
        // If unknown country, just spiral them slightly off coast of Africa so they don't break
        const fallback = [0 + (i * 2), 0 + (i * -2)]
        return { ...loc, coordinates: coords || fallback }
      })
  }, [rows, searchQuery, riskFilter])

  if (loading) return <SkeletonLoader type="card" count={1} />
  if (error) return <ErrorState message={error} />

  return (
    <div className="glass-panel locations-card">
      <div className="locations-head">
        <div>
          <div className="locations-title">Warehouse Locations</div>
          <div className="locations-subtitle">Global seller distribution</div>
        </div>
        <div className="locations-region"><MapPin size={15} /> Global</div>
      </div>

      <div className="locations-map" style={{ position: 'relative' }}>
        <ComposableMap 
          projection="geoEquirectangular" 
          projectionConfig={{ scale: 145 }} 
          width={800} height={400}
          style={{ width: '100%', height: '100%', outline: 'none' }}
        >
          <Graticule stroke="rgba(255,255,255,0.03)" strokeWidth={0.5} />
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(45, 20, 10, 0.85)"
                  stroke="rgba(255, 120, 40, 0.25)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: "rgba(65, 30, 15, 0.9)", outline: 'none' },
                    pressed: { outline: 'none' }
                  }}
                />
              ))
            }
          </Geographies>

          {locations.map(loc => {
            const isHigh = loc.maxRisk > 0.9
            const isMed = loc.maxRisk > 0.45 && !isHigh
            const outerColor = isHigh ? '#ff5b2b' : isMed ? '#f59e0b' : '#10b981'
            const innerColor = isHigh ? '#ff5b2b' : isMed ? '#f59e0b' : '#10b981'
            const bgOp = isHigh ? '0.2' : isMed ? '0.15' : '0.1'
            const isHov = hovered?.store_id === loc.store_id

            return (
              <Marker 
                key={loc.store_id} 
                coordinates={loc.coordinates}
                onMouseEnter={(e) => {
                  setHovered({ ...loc, x: e.pageX, y: e.pageY })
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onViewSKU?.(loc.store_id, loc.topProduct)}
                style={{ cursor: 'pointer' }}
              >
                <circle r={isHov ? 12 : 9} fill={outerColor} fillOpacity={bgOp} stroke={outerColor} strokeWidth={isHov ? 2.5 : 1.5} />
                <circle r={4} fill={innerColor} />
              </Marker>
            )
          })}
        </ComposableMap>

        {hovered && (
          <div className="location-tooltip" style={{ 
            position: 'fixed', 
            left: hovered.x, 
            top: hovered.y - 15, 
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none'
          }}>
            <strong>{hovered.store_id}</strong>
            <em>{hovered.count} SKU{hovered.count !== 1 ? 's' : ''} &middot; Risk {hovered.maxRisk.toFixed(3)}</em>
            {Number.isFinite(hovered.minDays) && <small>{hovered.minDays}d to stockout</small>}
          </div>
        )}
      </div>

      <div className="location-list">
        {locations.map(loc => {
          const level = loc.maxRisk > 0.9 ? 'high' : loc.maxRisk > 0.45 ? 'med' : 'low'
          return (
            <button key={loc.store_id} className="location-row" onClick={() => onViewSKU?.(loc.store_id, loc.topProduct)}>
              <span className={`loc-dot loc-dot-${level}`} />
              <span>{loc.store_id}</span>
              <strong>{loc.maxRisk.toFixed(3)}</strong>
              <small>{Number.isFinite(loc.minDays) ? `${loc.minDays}d` : '—'}</small>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LocationsGraph
