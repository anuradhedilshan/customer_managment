import React, { useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Flame,
  KeyRound,
  Lock,
  QrCode,
  Settings,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { StaffManager, SystemSettings } from '../types';
import { HotelLogo } from './HotelLogo';

interface LoginScreenProps {
  managers: StaffManager[];
  settings: SystemSettings;
  onLogin: (manager: StaffManager) => void;
  onOpenGuestPortal: () => void;
  onOpenConfigModal: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  managers,
  settings,
  onLogin,
  onOpenGuestPortal,
  onOpenConfigModal,
}) => {
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    managers[0]?.id || ''
  );
  const [pinInput, setPinInput] = useState<string>(managers[0]?.pin_code || '1111');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const selectedManager =
    managers.find((m) => m.id === selectedManagerId) || managers[0];

  const handleSelectRole = (manager: StaffManager) => {
    setSelectedManagerId(manager.id);
    setPinInput(manager.pin_code || '1234');
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;

    if (settings.require_login_pin && pinInput.trim() !== selectedManager.pin_code) {
      setErrorMsg(
        `Invalid PIN for ${selectedManager.full_name}. Demo PIN is ${selectedManager.pin_code}`
      );
      return;
    }

    onLogin(selectedManager);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Navigation & Notification Banner */}
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        {settings.show_login_notification_banner && settings.login_banner_message && (
          <div className="bg-slate-950 text-slate-200 border-b border-slate-800 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2">
            <BellRing className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              <strong>NOTICE:</strong> {settings.login_banner_message}
            </span>
          </div>
        )}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <HotelLogo
            logoUrl={settings.hotel_logo_url}
            darkText={false}
            subtitle="Customer Complaint & Heatmap Monitoring System"
          />

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenGuestPortal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Guest QR Portal</span>
            </button>
            <button
              type="button"
              onClick={onOpenConfigModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm border border-slate-700 transition"
            >
              <Settings className="w-4 h-4 text-slate-300" />
              <span>Login &amp; Notification Config</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: System Overview & Staff Profiles */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-orange-100 text-orange-800 text-xs font-semibold">
              <Flame className="w-3.5 h-3.5" />
              <span>2D Spatial Heatmap &amp; QR Complaint Management</span>
            </div>

            <h1 className="text-3xl font-bold text-slate-900">
              Customer Care &amp; Issue Heatmap System
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Manage location-based QR complaints across <strong>Tangerine Beach Hotel</strong>.
              Visualize recurring problem hotspots on the 2D hotel map, assign responsible
              department managers, and track resolution progress.
            </p>
          </div>

          {/* Role Selection Grid */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase text-slate-500">
              Select Staff Account (Click to Auto-Fill Login)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {managers.map((m) => {
                const isSelected = m.id === selectedManager?.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectRole(m)}
                    className={`text-left p-3.5 rounded-xl border transition flex items-start gap-3 bg-white ${
                      isSelected
                        ? 'border-slate-900 ring-2 ring-slate-900/10'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-sm"
                      style={{ backgroundColor: m.avatar_color || '#ea580c' }}
                    >
                      {m.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900 truncate">
                          {m.full_name}
                        </span>
                        {m.receive_all_complaints || m.role === 'super_manager' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                            SUPER MANAGER
                          </span>
                        ) : m.role === 'verification_officer' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 shrink-0">
                            VERIFIER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                            MANAGER
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 truncate">{m.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{m.department}</span>
                        <span className="font-mono">PIN: {m.pin_code}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Login Card */}
        <div className="lg:col-span-5">
          <div className="bg-white text-slate-900 rounded-xl shadow-sm p-6 sm:p-7 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Staff Login</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sign in to view the 2D hotel heatmap and manage complaints
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            {selectedManager && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                    Staff Account
                  </label>
                  <select
                    value={selectedManager.id}
                    onChange={(e) => {
                      const found = managers.find((m) => m.id === e.target.value);
                      if (found) handleSelectRole(found);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
                  >
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} — {m.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Access Summary Box */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Role Scope:</span>
                    <span className="font-bold text-slate-900">
                      {selectedManager.receive_all_complaints ||
                      selectedManager.role === 'super_manager'
                        ? 'Super Manager (Receives All Complaints)'
                        : selectedManager.role === 'verification_officer'
                        ? 'Verification Officer (Verifies & Dispatches)'
                        : `Dedicated Manager (${selectedManager.department})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Email:</span>
                    <span className="font-mono">{selectedManager.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Notifications:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {selectedManager.notify_sms ? 'SMS + ' : ''}
                      {selectedManager.notify_in_app ? 'In-App' : ''}
                    </span>
                  </div>
                </div>

                {settings.require_login_pin && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold uppercase text-slate-600">
                        PIN Code
                      </label>
                      <span className="text-xs text-slate-500">
                        Demo PIN: {selectedManager.pin_code}
                      </span>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setErrorMsg('');
                        }}
                        placeholder="Enter 4-digit PIN"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-2 text-sm font-mono focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Sign In as {selectedManager.full_name}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        Tangerine Beach Hotel, Kalutara • Customer Complaint &amp; Heatmap Monitoring System
      </footer>
    </div>
  );
};
