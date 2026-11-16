import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Crosshair,
  ExternalLink,
  MapPin,
  Printer,
  QrCode,
} from 'lucide-react';
import type { LocationZone, SystemSettings, ZoneType } from '../types';
import { supabase } from '../lib/supabase';
import { HotelLogo } from './HotelLogo';

interface QrConfiguratorViewProps {
  locations: LocationZone[];
  settings: SystemSettings;
  onSimulateScan: (location: LocationZone) => void;
  onRefresh: () => void;
}

export const QrConfiguratorView: React.FC<QrConfiguratorViewProps> = ({
  locations,
  settings,
  onSimulateScan,
  onRefresh,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<LocationZone>(
    locations[0]
  );
  const [pinningNewZone, setPinningNewZone] = useState<boolean>(false);
  const [newCoords, setNewCoords] = useState<{ x: number; y: number }>({
    x: 50,
    y: 50,
  });
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newRoomRange, setNewRoomRange] = useState('');
  const [newZoneType] = useState<ZoneType>('room_block');

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    if (pinningNewZone) {
      setNewCoords({ x, y });
    } else if (selectedLocation && e.shiftKey) {
      await supabase
        .from('locations')
        .update({ map_x: x, map_y: y })
        .eq('id', selectedLocation.id);
      onRefresh();
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        zone_type: newZoneType,
        room_range: newRoomRange.trim() || 'Dedicated Zone',
        map_x: newCoords.x,
        map_y: newCoords.y,
        description: 'Dedicated QR code complaint station',
        active: true,
      })
      .select('*')
      .single();

    if (!error && data) {
      setSelectedLocation(data as LocationZone);
      setPinningNewZone(false);
      setNewName('');
      setNewCode('');
      setNewRoomRange('');
      onRefresh();
    }
  };

  const getQrUrlForLocation = (loc: LocationZone) => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://tangerinehotels.com';
    return `${origin}/?qr=${encodeURIComponent(loc.code)}`;
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl p-5 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            QR Code Configurator &amp; Printable Cards
          </h3>
          <p className="text-xs text-slate-500">
            Place dedicated QR locations on the 2D hotel map and print location QR cards.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPinningNewZone(!pinningNewZone)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
            pinningNewZone
              ? 'bg-red-600 text-white'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          <span>
            {pinningNewZone
              ? 'Cancel Pin Placement'
              : '+ Place New QR Pin on 2D Map'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: 2D Map Pin Configurator */}
        <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between text-xs">
            <span>
              {pinningNewZone
                ? 'Click anywhere on the 2D map below to set coordinates for the new QR station'
                : 'Click any QR pin to view its QR code (Shift + Click map to move selected pin)'}
            </span>
            <span className="font-mono text-slate-300">
              {locations.length} Locations
            </span>
          </div>

          <div
            onClick={handleMapClick}
            className={`relative w-full aspect-[4/3] bg-[#f4f1ea] overflow-hidden select-none ${
              pinningNewZone ? 'cursor-crosshair' : ''
            }`}
          >
            <img
              src="/hotel-map-2d.jpg"
              alt="Tangerine Beach Hotel QR Pin Map"
              className="w-full h-full object-contain"
            />

            {locations.map((loc) => {
              const isSelected = selectedLocation?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLocation(loc);
                  }}
                  style={{ left: `${loc.map_x}%`, top: `${loc.map_y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group z-10"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border shadow transition ${
                      isSelected
                        ? 'bg-orange-600 text-white border-white scale-125'
                        : 'bg-slate-900 text-white border-white group-hover:scale-110'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-700'
                        : 'bg-white text-slate-800 border-slate-300'
                    }`}
                  >
                    {loc.code}
                  </span>
                </button>
              );
            })}

            {pinningNewZone && (
              <div
                style={{ left: `${newCoords.x}%`, top: `${newCoords.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-20"
              >
                <div className="w-8 h-8 rounded-full bg-red-600 text-white border-2 border-white flex items-center justify-center shadow">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="mt-1 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                  NEW ({newCoords.x}%, {newCoords.y}%)
                </span>
              </div>
            )}
          </div>

          {pinningNewZone && (
            <form
              onSubmit={handleCreateLocation}
              className="p-4 bg-slate-50 border-t border-slate-200 space-y-3"
            >
              <div className="text-xs font-bold text-slate-800">
                Save New QR Location at ({newCoords.x}%, {newCoords.y}%)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Location Name (e.g. Spa)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Code (e.g. SPA-01)"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono uppercase bg-white"
                />
                <input
                  type="text"
                  placeholder="Room Range / Area"
                  value={newRoomRange}
                  onChange={(e) => setNewRoomRange(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs bg-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
                >
                  Save QR Location
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right 5 Cols: Printable QR Card */}
        <div className="xl:col-span-5 space-y-4">
          {selectedLocation && (
            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 text-center">
              <div className="bg-slate-900 text-white px-5 py-4 flex justify-center">
                <HotelLogo
                  logoUrl={settings.hotel_logo_url}
                  size="md"
                  darkText={false}
                  subtitle="Guest QR Complaint Service"
                />
              </div>
              <div className="p-6 space-y-4">

              <div className="inline-block px-3 py-1 rounded bg-slate-100 text-slate-800 text-xs font-bold uppercase border border-slate-300">
                {selectedLocation.code} • {selectedLocation.room_range}
              </div>

              <h4 className="text-base font-bold text-slate-900">
                {selectedLocation.name}
              </h4>

              <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mx-auto">
                <QRCodeSVG
                  value={getQrUrlForLocation(selectedLocation)}
                  size={170}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <p className="text-xs text-slate-600 max-w-xs mx-auto">
                Scan this QR code to submit a room or facility complaint with your room number.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => onSimulateScan(selectedLocation)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Simulate Guest QR Scan</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print QR Card</span>
                </button>
              </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2.5">
            <div className="text-xs font-bold uppercase text-slate-500">
              All QR Locations ({locations.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLocation(loc)}
                  className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between ${
                    selectedLocation?.id === loc.id
                      ? 'bg-orange-50 border-orange-600 text-slate-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{loc.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {loc.code}
                    </div>
                  </div>
                  <QrCode className="w-4 h-4 text-slate-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
