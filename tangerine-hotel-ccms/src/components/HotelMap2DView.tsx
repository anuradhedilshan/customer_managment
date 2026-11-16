import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Flame,
  Layers,
  MapPin,
  PlusCircle,
  QrCode,
  Sliders,
  SplitSquareVertical,
  X,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  Intervention,
  LocationZone,
  ProblemCategory,
  RoutingRule,
  StaffManager,
} from '../types';
import { supabase } from '../lib/supabase';
import { CategoryIcon } from './CategoryIcon';

interface HotelMap2DViewProps {
  locations: LocationZone[];
  complaints: Complaint[];
  categories: ProblemCategory[];
  managers: StaffManager[];
  rules: RoutingRule[];
  interventions: Intervention[];
  currentUser: StaffManager;
  onUpdateComplaintStatus: (
    complaint: Complaint,
    newStatus: ComplaintStatus,
    notes?: string
  ) => Promise<void>;
  onOpenQrForLocation: (location: LocationZone) => void;
  onRefreshData: () => void;
}

type VisualMode = 'heatmap' | 'status_2d' | 'before_after';
type StatusScope = 'unresolved_only' | 'all' | 'resolved_only';

interface HeatPoint {
  xPercent: number;
  yPercent: number;
  intensity: number; // 0.0 to 1.0+
}

/**
 * True HTML5 Canvas 2D Spatial Heatmap Renderer
 * Draws smooth alpha heat kernels and colorizes pixels using a standard thermal LUT:
 * Blue (Low) -> Cyan -> Green (Moderate) -> Yellow (High) -> Red (Critical Hotspot)
 */
const HeatmapCanvasOverlay: React.FC<{
  points: HeatPoint[];
  radiusScale?: number;
  opacity?: number;
}> = ({ points, radiusScale = 1, opacity = 0.78 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = 960;
    const height = 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (points.length === 0) return;

    // Step 1: Draw grayscale alpha intensity blobs
    points.forEach((pt) => {
      if (pt.intensity <= 0) return;
      const cx = (pt.xPercent / 100) * width;
      const cy = (pt.yPercent / 100) * height;
      const radius = Math.round((85 + pt.intensity * 45) * radiusScale);
      const alpha = Math.min(1, Math.max(0.18, pt.intensity));

      const grad = ctx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      grad.addColorStop(0.45, `rgba(0, 0, 0, ${alpha * 0.6})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Step 2: Colorize alpha channel using a 256-entry thermal palette
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]; // 0..255
      if (a < 8) {
        data[i + 3] = 0;
        continue;
      }

      const t = a / 255; // normalized intensity 0..1
      let r = 0;
      let g = 0;
      let b = 0;

      if (t < 0.25) {
        // Blue -> Cyan
        const local = t / 0.25;
        r = 0;
        g = Math.round(180 * local);
        b = 255;
      } else if (t < 0.5) {
        // Cyan -> Green
        const local = (t - 0.25) / 0.25;
        r = 0;
        g = 180 + Math.round(60 * local);
        b = Math.round(255 * (1 - local));
      } else if (t < 0.75) {
        // Green -> Yellow/Orange
        const local = (t - 0.5) / 0.25;
        r = Math.round(255 * local);
        g = 240 - Math.round(40 * local);
        b = 0;
      } else {
        // Orange -> Deep Red Hotspot
        const local = (t - 0.75) / 0.25;
        r = 255;
        g = Math.round(200 * (1 - local));
        b = 0;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = Math.min(235, Math.round(a * opacity * 1.15));
    }

    ctx.putImageData(imgData, 0, 0);
  }, [points, radiusScale, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
};

export const HotelMap2DView: React.FC<HotelMap2DViewProps> = ({
  locations,
  complaints,
  categories,
  managers,
  rules,
  interventions,
  currentUser,
  onUpdateComplaintStatus,
  onOpenQrForLocation,
  onRefreshData,
}) => {
  const [visualMode, setVisualMode] = useState<VisualMode>('heatmap');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusScope, setStatusScope] = useState<StatusScope>('all');
  const [heatRadius, setHeatRadius] = useState<number>(1.05);
  const [showPinLabels, setShowPinLabels] = useState<boolean>(true);

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    locations.find((l) => l.code === 'BLK-04')?.id || locations[0]?.id || null
  );
  const [selectedInterventionId, setSelectedInterventionId] = useState<string>(
    interventions[0]?.id || ''
  );
  const [showLogInterventionModal, setShowLogInterventionModal] = useState(false);
  const [newInterventionTitle, setNewInterventionTitle] = useState('');
  const [newInterventionLocationId, setNewInterventionLocationId] = useState<string>('');
  const [newInterventionNotes, setNewInterventionNotes] = useState('');
  const [resolutionNoteInput, setResolutionNoteInput] = useState<Record<string, string>>({});

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  const activeIntervention = useMemo(
    () => interventions.find((i) => i.id === selectedInterventionId) || interventions[0],
    [interventions, selectedInterventionId]
  );

  const interventionCutoffTime = useMemo(() => {
    if (activeIntervention) {
      return new Date(activeIntervention.performed_at).getTime();
    }
    return Date.now() - 3 * 24 * 3600 * 1000;
  }, [activeIntervention]);

  // Compute per-location statistics & heat score
  const locationStats = useMemo(() => {
    return locations.map((loc) => {
      const matchingComplaints = complaints.filter((c) => {
        if (c.location_id !== loc.id) return false;
        if (categoryFilter === 'pest_only') {
          const cat = categories.find((catItem) => catItem.id === c.category_id);
          if (!cat?.is_pest_related) return false;
        } else if (categoryFilter !== 'all' && c.category_id !== categoryFilter) {
          return false;
        }

        if (statusScope === 'unresolved_only') {
          return c.status !== 'resolved' && c.status !== 'rejected';
        }
        if (statusScope === 'resolved_only') {
          return c.status === 'resolved';
        }
        return true;
      });

      const unresolved = matchingComplaints.filter(
        (c) =>
          c.status === 'pending_verification' ||
          c.status === 'verified' ||
          c.status === 'in_progress'
      );
      const inProgress = matchingComplaints.filter((c) => c.status === 'in_progress');
      const resolved = matchingComplaints.filter((c) => c.status === 'resolved');

      const heatScore = matchingComplaints.reduce((acc, c) => {
        const statusWeight = c.status === 'resolved' ? 0.45 : 1.25;
        const sevWeight =
          c.severity === 'critical'
            ? 3.5
            : c.severity === 'high'
            ? 2.5
            : c.severity === 'medium'
            ? 1.75
            : 1.0;
        return acc + statusWeight * sevWeight;
      }, 0);

      const applicableRule = rules.find(
        (r) => r.active && (!r.location_id || r.location_id === loc.id)
      );
      const threshold = applicableRule?.hotspot_threshold || 2;
      const isHotspot =
        unresolved.length >= threshold || matchingComplaints.length >= threshold + 1;

      let statusState: 'unresolved' | 'in_progress' | 'resolved' | 'clear' = 'clear';
      if (unresolved.length > 0) {
        statusState = inProgress.length === unresolved.length ? 'in_progress' : 'unresolved';
      } else if (resolved.length > 0) {
        statusState = 'resolved';
      }

      return {
        location: loc,
        complaints: matchingComplaints,
        unresolvedCount: unresolved.length,
        inProgressCount: inProgress.length,
        resolvedCount: resolved.length,
        totalCount: matchingComplaints.length,
        heatScore,
        isHotspot,
        threshold,
        statusState,
      };
    });
  }, [locations, complaints, categories, categoryFilter, statusScope, rules]);

  const maxHeatScore = useMemo(
    () => Math.max(5, ...locationStats.map((s) => s.heatScore)),
    [locationStats]
  );

  const heatmapPoints: HeatPoint[] = useMemo(() => {
    return locationStats
      .filter((s) => s.heatScore > 0)
      .map((s) => ({
        xPercent: Number(s.location.map_x),
        yPercent: Number(s.location.map_y),
        intensity: Math.min(1, Math.max(0.28, s.heatScore / maxHeatScore)),
      }));
  }, [locationStats, maxHeatScore]);

  // Before vs After Intervention Heatmap Points
  const beforeAfterStats = useMemo(() => {
    return locations.map((loc) => {
      const relevant = complaints.filter((c) => {
        if (c.location_id !== loc.id) return false;
        if (categoryFilter === 'pest_only') {
          const cat = categories.find((catItem) => catItem.id === c.category_id);
          return Boolean(cat?.is_pest_related);
        }
        if (categoryFilter !== 'all') {
          return c.category_id === categoryFilter;
        }
        return true;
      });

      const beforeList = relevant.filter(
        (c) => new Date(c.created_at).getTime() <= interventionCutoffTime
      );
      const afterList = relevant.filter(
        (c) =>
          new Date(c.created_at).getTime() > interventionCutoffTime &&
          c.status !== 'resolved'
      );

      return {
        location: loc,
        beforeCount: beforeList.length,
        afterCount: afterList.length,
        improved: beforeList.length > 0 && afterList.length === 0,
      };
    });
  }, [locations, complaints, categories, categoryFilter, interventionCutoffTime]);

  const beforeHeatPoints: HeatPoint[] = useMemo(() => {
    return beforeAfterStats
      .filter((s) => s.beforeCount > 0)
      .map((s) => ({
        xPercent: Number(s.location.map_x),
        yPercent: Number(s.location.map_y),
        intensity: Math.min(1, 0.35 + s.beforeCount * 0.3),
      }));
  }, [beforeAfterStats]);

  const afterHeatPoints: HeatPoint[] = useMemo(() => {
    return beforeAfterStats
      .filter((s) => s.afterCount > 0)
      .map((s) => ({
        xPercent: Number(s.location.map_x),
        yPercent: Number(s.location.map_y),
        intensity: Math.min(1, 0.4 + s.afterCount * 0.32),
      }));
  }, [beforeAfterStats]);

  const handleCreateIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInterventionTitle.trim()) return;
    await supabase.from('interventions').insert({
      title: newInterventionTitle.trim(),
      location_id: newInterventionLocationId || null,
      department: currentUser.department || 'Health & Safety / Pest Control',
      performed_by: currentUser.full_name,
      performed_at: new Date().toISOString(),
      notes: newInterventionNotes.trim(),
    });
    setNewInterventionTitle('');
    setNewInterventionNotes('');
    setShowLogInterventionModal(false);
    onRefreshData();
  };

  const selectedLocationStat = useMemo(
    () => locationStats.find((s) => s.location.id === selectedLocationId) || null,
    [locationStats, selectedLocationId]
  );

  const rankedHotspots = useMemo(
    () =>
      [...locationStats]
        .filter((s) => s.totalCount > 0)
        .sort((a, b) => b.heatScore - a.heatScore),
    [locationStats]
  );

  return (
    <div className="space-y-5">
      {/* Top Toolbar: View Switcher & Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        {/* View Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVisualMode('heatmap')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              visualMode === 'heatmap'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-4 h-4 text-orange-500" />
            <span>2D Spatial Heatmap</span>
          </button>

          <button
            type="button"
            onClick={() => setVisualMode('status_2d')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              visualMode === 'status_2d'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>2D Status Map</span>
          </button>

          <button
            type="button"
            onClick={() => setVisualMode('before_after')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              visualMode === 'before_after'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <SplitSquareVertical className="w-4 h-4 text-emerald-600" />
            <span>Before vs. After Heatmap</span>
          </button>
        </div>

        {/* Filters: Category, Status Scope, Radius */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">All Complaint Categories</option>
            <option value="pest_only">Pest &amp; Mosquitoes Only</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {visualMode !== 'before_after' && (
            <select
              value={statusScope}
              onChange={(e) => setStatusScope(e.target.value as StatusScope)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="all">All Statuses (Active + Resolved)</option>
              <option value="unresolved_only">Active / Unresolved Issues Only</option>
              <option value="resolved_only">Resolved Issues Only</option>
            </select>
          )}

          {visualMode === 'heatmap' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">Heat Radius:</span>
              <input
                type="range"
                min="0.6"
                max="1.5"
                step="0.05"
                value={heatRadius}
                onChange={(e) => setHeatRadius(Number(e.target.value))}
                className="w-20 accent-orange-600"
              />
            </div>
          )}

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={showPinLabels}
              onChange={(e) => setShowPinLabels(e.target.checked)}
              className="w-4 h-4 accent-slate-900 rounded"
            />
            <span>Zone Labels</span>
          </label>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Active / Open Complaints</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {locationStats.reduce((sum, s) => sum + s.unresolvedCount, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Across {locationStats.filter((s) => s.unresolvedCount > 0).length} hotel zones
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Critical Hotspot Zones</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">
            {locationStats.filter((s) => s.isHotspot).length}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Exceeding recurrence threshold
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">In-Progress Dispatches</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {locationStats.reduce((sum, s) => sum + s.inProgressCount, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Assigned to department teams
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-medium text-slate-500">Resolved Complaints</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {locationStats.reduce((sum, s) => sum + s.resolvedCount, 0)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Verified &amp; closed with guest SMS
          </div>
        </div>
      </div>

      {/* MODE 1 & 2: Single 2D Map + Side Details Panel */}
      {visualMode !== 'before_after' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left 8 Cols: 2D Map with Heatmap Canvas */}
          <div className="xl:col-span-8 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-bold text-slate-900">
                  {visualMode === 'heatmap'
                    ? 'Tangerine Beach Hotel — 2D Issue Density Heatmap'
                    : 'Tangerine Beach Hotel — 2D Zone Status Map'}
                </span>
              </div>

              {/* Thermal Color Scale Legend */}
              {visualMode === 'heatmap' ? (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Low</span>
                  <div className="flex h-3 w-36 rounded overflow-hidden border border-slate-300">
                    <div className="flex-1 bg-blue-500" />
                    <div className="flex-1 bg-cyan-400" />
                    <div className="flex-1 bg-green-500" />
                    <div className="flex-1 bg-yellow-400" />
                    <div className="flex-1 bg-orange-500" />
                    <div className="flex-1 bg-red-600" />
                  </div>
                  <span className="font-semibold text-red-600">High Hotspot</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span>Open Issue</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>In Progress</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span>Resolved</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>Clear</span>
                  </span>
                </div>
              )}
            </div>

            {/* 2D Map Container */}
            <div className="relative w-full aspect-[4/3] bg-[#f4f1ea] overflow-hidden select-none">
              <img
                src="/hotel-map-2d.jpg"
                alt="Tangerine Beach Hotel 2D Floor Plan"
                className="w-full h-full object-contain"
              />

              {/* HTML5 Canvas Heatmap Layer */}
              {visualMode === 'heatmap' && (
                <HeatmapCanvasOverlay points={heatmapPoints} radiusScale={heatRadius} />
              )}

              {/* Interactive Location Markers */}
              {locationStats.map((stat) => {
                const isSelected = stat.location.id === selectedLocationId;
                const badgeBg =
                  stat.statusState === 'unresolved'
                    ? 'bg-red-600 text-white border-white'
                    : stat.statusState === 'in_progress'
                    ? 'bg-amber-500 text-white border-white'
                    : stat.statusState === 'resolved'
                    ? 'bg-emerald-600 text-white border-white'
                    : 'bg-slate-700 text-white border-white';

                return (
                  <button
                    key={stat.location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(stat.location.id)}
                    style={{
                      left: `${stat.location.map_x}%`,
                      top: `${stat.location.map_y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center focus:outline-none group"
                  >
                    <div
                      className={`w-7 h-7 rounded-full border-2 shadow flex items-center justify-center text-xs font-bold transition-transform ${badgeBg} ${
                        isSelected ? 'scale-125 ring-2 ring-slate-900' : 'group-hover:scale-110'
                      }`}
                    >
                      {stat.totalCount}
                    </div>

                    {showPinLabels && (
                      <div
                        className={`mt-1 px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border shadow-sm ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900'
                            : stat.isHotspot && stat.unresolvedCount > 0
                            ? 'bg-red-600 text-white border-red-700'
                            : 'bg-white text-slate-800 border-slate-300'
                        }`}
                      >
                        {stat.location.code}
                        {stat.isHotspot && stat.unresolvedCount > 0 ? ' (Hotspot)' : ''}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hotspot Ranking Strip Below Map */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="text-xs font-bold uppercase text-slate-500 mb-2.5">
                Hotspot Density Ranking by Hotel Location
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {rankedHotspots.slice(0, 6).map((stat) => {
                  const pct = Math.min(100, Math.round((stat.heatScore / maxHeatScore) * 100));
                  return (
                    <button
                      key={stat.location.id}
                      type="button"
                      onClick={() => setSelectedLocationId(stat.location.id)}
                      className={`p-2.5 rounded-lg border text-left transition bg-white ${
                        selectedLocationId === stat.location.id
                          ? 'border-slate-900 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                        <span>{stat.location.code}</span>
                        <span
                          className={
                            stat.unresolvedCount > 0 ? 'text-red-600' : 'text-emerald-600'
                          }
                        >
                          {stat.totalCount} reports
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          style={{ width: `${pct}%` }}
                          className={`h-full ${
                            pct >= 70
                              ? 'bg-red-600'
                              : pct >= 40
                              ? 'bg-orange-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 4 Cols: Selected Location Details & Action Panel */}
          <div className="xl:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            {selectedLocation && selectedLocationStat ? (
              <>
                <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">
                        {selectedLocation.code} • {selectedLocation.room_range}
                      </div>
                      <h3 className="text-base font-bold mt-0.5">{selectedLocation.name}</h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {selectedLocation.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenQrForLocation(selectedLocation)}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Test QR</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-base font-bold text-red-400">
                        {selectedLocationStat.unresolvedCount}
                      </div>
                      <div className="text-[11px] text-slate-300">Open</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-base font-bold text-emerald-400">
                        {selectedLocationStat.resolvedCount}
                      </div>
                      <div className="text-[11px] text-slate-300">Resolved</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-2">
                      <div className="text-base font-bold text-amber-300">
                        {selectedLocationStat.isHotspot ? 'Hotspot' : 'Normal'}
                      </div>
                      <div className="text-[11px] text-slate-300">Density</div>
                    </div>
                  </div>
                </div>

                {/* Complaints List for Selected Location */}
                <div className="p-4 space-y-3 max-h-[540px] overflow-y-auto divide-y divide-slate-200">
                  {selectedLocationStat.complaints.length === 0 ? (
                    <div className="py-10 text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div className="text-sm font-bold text-slate-800">
                        No Matching Complaints in This Zone
                      </div>
                      <p className="text-xs text-slate-500">
                        Click &ldquo;Test QR&rdquo; above to submit a new guest complaint for{' '}
                        {selectedLocation.name}.
                      </p>
                    </div>
                  ) : (
                    selectedLocationStat.complaints.map((c) => {
                      const cat = categories.find((catItem) => catItem.id === c.category_id);
                      const assignedMgr = managers.find((m) => m.id === c.assigned_manager_id);

                      return (
                        <div key={c.id} className="pt-3 first:pt-0 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: cat?.color || '#ea580c' }}
                              >
                                <CategoryIcon name={cat?.icon || 'Bug'} className="w-4 h-4" />
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900">
                                    {c.ticket_number}
                                  </span>
                                  <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                                    Room {c.room_number}
                                  </span>
                                </div>
                                <div className="text-xs font-semibold text-slate-800 mt-0.5">
                                  {c.specific_issue}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.status === 'resolved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : c.status === 'verified'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {c.status.replace('_', ' ')}
                            </span>
                          </div>

                          {c.description && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {c.description}
                            </p>
                          )}

                          {c.image_url && (
                            <div className="rounded-lg overflow-hidden border border-slate-200 max-h-36">
                              <img
                                src={c.image_url}
                                alt="Evidence"
                                className="w-full h-32 object-cover"
                              />
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>
                              Guest: <strong className="text-slate-700">{c.guest_name}</strong>
                            </span>
                            <span>
                              Manager:{' '}
                              <strong className="text-slate-700">
                                {assignedMgr?.full_name || 'Unassigned'}
                              </strong>
                            </span>
                          </div>

                          {c.status !== 'resolved' && (
                            <div className="pt-1 space-y-2">
                              <input
                                type="text"
                                placeholder="Add verification / resolution note..."
                                value={resolutionNoteInput[c.id] || ''}
                                onChange={(e) =>
                                  setResolutionNoteInput({
                                    ...resolutionNoteInput,
                                    [c.id]: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                              />
                              <div className="flex flex-wrap items-center gap-1.5">
                                {c.status === 'pending_verification' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateComplaintStatus(
                                        c,
                                        'verified',
                                        resolutionNoteInput[c.id] ||
                                          `Verified by ${currentUser.full_name}`
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                                  >
                                    Verify
                                  </button>
                                )}
                                {(c.status === 'pending_verification' ||
                                  c.status === 'verified') && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateComplaintStatus(
                                        c,
                                        'in_progress',
                                        resolutionNoteInput[c.id] ||
                                          'Team dispatched to location'
                                      )
                                    }
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                                  >
                                    In Progress
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateComplaintStatus(
                                      c,
                                      'resolved',
                                      resolutionNoteInput[c.id] ||
                                        'Issue resolved & verified'
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold ml-auto"
                                >
                                  Mark Resolved
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        /* MODE 3: BEFORE VS AFTER INTERVENTION HEATMAP COMPARISON */
        <div className="space-y-5">
          <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Before vs. After Intervention Heatmap Comparison
              </h3>
              <p className="text-xs text-slate-500">
                Compare spatial heatmap density before and after a pest-control or maintenance
                intervention.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedInterventionId}
                onChange={(e) => setSelectedInterventionId(e.target.value)}
                className="rounded-lg bg-white border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {interventions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({new Date(item.performed_at).toLocaleDateString()})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowLogInterventionModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Log Intervention</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BOARD 1: BEFORE INTERVENTION HEATMAP */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">
                    Board 1 — Heatmap Before Intervention
                  </h4>
                  <p className="text-xs text-slate-400">
                    Complaint density recorded prior to corrective action
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold">
                  {beforeAfterStats.filter((s) => s.beforeCount > 0).length} Affected Zones
                </span>
              </div>

              <div className="relative w-full aspect-[4/3] bg-[#f4f1ea] overflow-hidden">
                <img
                  src="/hotel-map-2d.jpg"
                  alt="Before Intervention Heatmap"
                  className="w-full h-full object-contain"
                />
                <HeatmapCanvasOverlay points={beforeHeatPoints} radiusScale={1.0} />
                {beforeAfterStats.map((stat) => (
                  <div
                    key={`before-${stat.location.id}`}
                    style={{
                      left: `${stat.location.map_x}%`,
                      top: `${stat.location.map_y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border border-white flex items-center justify-center text-xs font-bold ${
                        stat.beforeCount > 0
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-600 text-white opacity-60'
                      }`}
                    >
                      {stat.beforeCount}
                    </div>
                    <span className="mt-0.5 px-1.5 py-0.2 rounded bg-white/95 border border-slate-300 text-[9px] font-semibold text-slate-800">
                      {stat.location.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* BOARD 2: AFTER INTERVENTION HEATMAP */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold">
                    Board 2 — Heatmap After Intervention (Current)
                  </h4>
                  <p className="text-xs text-slate-400">
                    Remaining active hotspots after corrective action
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold">
                  {beforeAfterStats.filter((s) => s.improved).length} Zones Cleared
                </span>
              </div>

              <div className="relative w-full aspect-[4/3] bg-[#f4f1ea] overflow-hidden">
                <img
                  src="/hotel-map-2d.jpg"
                  alt="After Intervention Heatmap"
                  className="w-full h-full object-contain"
                />
                <HeatmapCanvasOverlay points={afterHeatPoints} radiusScale={1.0} />
                {beforeAfterStats.map((stat) => (
                  <div
                    key={`after-${stat.location.id}`}
                    style={{
                      left: `${stat.location.map_x}%`,
                      top: `${stat.location.map_y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center"
                  >
                    <div
                      className={`w-6 h-6 rounded-full border border-white flex items-center justify-center text-xs font-bold ${
                        stat.afterCount > 0
                          ? 'bg-red-600 text-white'
                          : stat.improved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-600 text-white opacity-60'
                      }`}
                    >
                      {stat.afterCount}
                    </div>
                    <span className="mt-0.5 px-1.5 py-0.2 rounded bg-white/95 border border-slate-300 text-[9px] font-semibold text-slate-800">
                      {stat.location.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal to Log Intervention */}
      {showLogInterventionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Log Corrective Intervention
              </h3>
              <button
                type="button"
                onClick={() => setShowLogInterventionModal(false)}
                className="p-1 rounded-lg bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateIntervention} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Intervention Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Thermal Fogging & Drain Treatment at Block 04"
                  value={newInterventionTitle}
                  onChange={(e) => setNewInterventionTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Target Location
                </label>
                <select
                  value={newInterventionLocationId}
                  onChange={(e) => setNewInterventionLocationId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Hotel-Wide / Multiple Blocks</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={newInterventionNotes}
                  onChange={(e) => setNewInterventionNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogInterventionModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                >
                  Save Intervention
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
