import { useEffect, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { API_BASE } from '../config'
import ErrorState from './ErrorState'
import SkeletonLoader from './SkeletonLoader'

const COUNTRY_COORDS = {
  BR: [-51.9, -14.2],
  US: [-98.5, 39.8],
  IN: [78.9, 22.9],
  CN: [104.2, 35.9],
  GB: [-3.4, 55.4],
  DE: [10.4, 51.2],
  FR: [2.2, 46.2],
  AU: [133.8, -25.3],
  JP: [138.2, 36.2],
  CA: [-106.3, 56.1],
}

const project = (storeId, index, total) => {
  const country = String(storeId || '').split('-').pop()?.toUpperCase()
  const coords = COUNTRY_COORDS[country]
  if (coords) {
    const [lon, lat] = coords
    return {
      x: ((lon + 180) / 360) * 100,
      y: ((90 - lat) / 180) * 100,
    }
  }

  const angle = (index / Math.max(total, 1)) * Math.PI * 2
  return {
    x: 50 + Math.cos(angle) * 34,
    y: 50 + Math.sin(angle) * 22,
  }
}

const LocationsGraph = ({ refreshKey = 0, searchQuery = '', riskFilter = 'all', selectedDate = '', onViewSKU }) => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/risk?limit=100${selectedDate ? `&date=${selectedDate}` : ''}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(json => {
        setRows(json.grid || [])
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [refreshKey, selectedDate])

  const locations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const grouped = new Map()

    rows.forEach(row => {
      const score = Number(row.risk_score || 0)
      const level = score > 0.1 ? 'high' : score > 0.05 ? 'med' : 'low'
      if (riskFilter !== 'all' && level !== riskFilter) return
      if (q && !`${row.store_id} ${row.product_id}`.toLowerCase().includes(q)) return

      const current = grouped.get(row.store_id) || {
        store_id: row.store_id,
        count: 0,
        high: 0,
        maxRisk: 0,
        minDays: Infinity,
        topProduct: row.product_id,
      }

      current.count += 1
      current.high += level === 'high' ? 1 : 0
      if (score >= current.maxRisk) {
        current.maxRisk = score
        current.topProduct = row.product_id
      }
      current.minDays = Math.min(current.minDays, Number(row.days_to_stockout ?? Infinity))
      grouped.set(row.store_id, current)
    })

    return Array.from(grouped.values())
      .sort((a, b) => b.maxRisk - a.maxRisk)
      .slice(0, 10)
      .map((loc, index, list) => {
        const point = project(loc.store_id, index, list.length)
        return { ...loc, ...point }
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

      <div className="locations-map" role="img" aria-label="Store risk location graph">
        <svg viewBox="0 0 1000 520" preserveAspectRatio="xMidYMid meet">
          <g className="map-land">
            <path d="M92 164l32-21 51 2 45-20 75 8 37 28-12 30 24 31-31 44 7 41-31 34-54 5-30-34-42-17-10-44-48-29z" />
            <path d="M255 331l47 17 31 45 31 33-7 44-37 26-29-28-19-46-39-37z" />
            <path d="M400 139l42-18 57 2 37 18 10 31-40 20-51-8-41 20-31-20z" />
            <path d="M482 211l54-27 73 16 63-28 74 6 51-17 102 30 48 43-39 41-87-5-43 28-81-8-58 34-66-9-53 32-65-30-42 16-42-40z" />
            <path d="M568 337l55-12 49 25 22 62-25 70-58-16-39-53z" />
            <path d="M745 365l75 15 38 41-48 29-74-21z" />
            <path d="M851 286l58 15 37 31-43 28-63-17z" />
            <path d="M44 214l43-39 50 20-19 47-57 15z" />
          </g>
          <g className="map-lines">
            <path d="M80 193 C210 126 330 151 446 190 C578 236 729 176 925 226" />
            <path d="M96 261 C239 218 365 238 501 268 C637 300 762 266 907 315" />
            <path d="M154 147 C145 225 148 300 172 357" />
            <path d="M312 128 C293 222 292 317 327 402" />
            <path d="M520 122 C500 214 502 306 536 405" />
            <path d="M718 132 C690 223 692 315 732 396" />
          </g>
        </svg>

        {locations.map(loc => {
          const level = loc.maxRisk > 0.1 ? 'high' : loc.maxRisk > 0.05 ? 'med' : 'low'
          return (
            <button
              key={loc.store_id}
              className={`location-node ${level}`}
              style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
              title={`${loc.store_id}: ${loc.count} SKU(s), max risk ${loc.maxRisk.toFixed(3)}`}
              onClick={() => onViewSKU?.(loc.store_id, loc.topProduct)}
            >
              <span />
            </button>
          )
        })}
      </div>

      <div className="location-list">
        {locations.map(loc => (
          <button key={loc.store_id} className="location-row" onClick={() => onViewSKU?.(loc.store_id, loc.topProduct)}>
            <span>{loc.store_id}</span>
            <strong>{loc.maxRisk.toFixed(3)}</strong>
            <small>{Number.isFinite(loc.minDays) ? `${loc.minDays}d` : '-'}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

export default LocationsGraph
