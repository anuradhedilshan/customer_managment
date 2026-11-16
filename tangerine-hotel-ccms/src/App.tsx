import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  ClipboardList,
  Flame,
  GitBranch,
  LogOut,
  MessageSquare,
  PlusCircle,
  QrCode,
  Settings,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  Intervention,
  LocationZone,
  ProblemCategory,
  RoutingRule,
  StaffManager,
  SystemSettings,
} from './types';
import {
  DEFAULT_SETTINGS,
  formatSmsMessage,
  supabase,
} from './lib/supabase';
import { HotelLogo } from './components/HotelLogo';
import { LoginScreen } from './components/LoginScreen';
import { HotelMap2DView } from './components/HotelMap2DView';
import { ComplaintsQueueView } from './components/ComplaintsQueueView';
import { VisualAssignmentAndRules } from './components/VisualAssignmentAndRules';
import { ProblemCategoriesManager } from './components/ProblemCategoriesManager';
import { QrConfiguratorView } from './components/QrConfiguratorView';
import { GuestQrPortalModal } from './components/GuestQrPortalModal';
import { NotificationAndLoginConfigModal } from './components/NotificationAndLoginConfigModal';

type NavTab =
  | 'map_heatmap'
  | 'complaints_queue'
  | 'visual_rules'
  | 'problem_builder'
  | 'qr_configurator';

export function App() {
  const [locations, setLocations] = useState<LocationZone[]>([]);
  const [managers, setManagers] = useState<StaffManager[]>([]);
  const [categories, setCategories] = useState<ProblemCategory[]>([]);
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentUser, setCurrentUser] = useState<StaffManager | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('map_heatmap');

  const [guestModalOpen, setGuestModalOpen] = useState<boolean>(false);
  const [guestModalLocation, setGuestModalLocation] = useState<LocationZone | null>(
    null
  );
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<{
    title: string;
    subtitle: string;
    smsPreview?: string;
  } | null>(null);

  const fetchAllData = useCallback(async () => {
    const [
      locRes,
      mgrRes,
      catRes,
      ruleRes,
      compRes,
      intRes,
      setRes,
    ] = await Promise.all([
      supabase.from('locations').select('*').order('code'),
      supabase.from('staff_managers').select('*').order('created_at'),
      supabase.from('problem_categories').select('*').order('created_at'),
      supabase.from('routing_rules').select('*').order('priority_order'),
      supabase.from('complaints').select('*').order('created_at', { ascending: false }),
      supabase.from('interventions').select('*').order('performed_at', { ascending: false }),
      supabase.from('system_settings').select('*').eq('id', 'default').maybeSingle(),
    ]);

    if (locRes.data) setLocations(locRes.data as LocationZone[]);
    if (mgrRes.data) {
      const staffList = mgrRes.data as StaffManager[];
      setManagers(staffList);
      setCurrentUser((prev) =>
        prev ? staffList.find((s) => s.id === prev.id) || prev : null
      );
    }
    if (catRes.data) setCategories(catRes.data as ProblemCategory[]);
    if (ruleRes.data) setRules(ruleRes.data as RoutingRule[]);
    if (compRes.data) setComplaints(compRes.data as Complaint[]);
    if (intRes.data) setInterventions(intRes.data as Intervention[]);
    if (setRes.data) setSettings(setRes.data as SystemSettings);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('tangerine-ccms-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations' },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);

  useEffect(() => {
    if (locations.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const qrCodeParam = params.get('qr');
    if (qrCodeParam) {
      const matched =
        locations.find(
          (l) => l.code.toLowerCase() === qrCodeParam.toLowerCase()
        ) || locations[0];
      setGuestModalLocation(matched);
      setGuestModalOpen(true);
    }
  }, [locations]);

  const showNotificationToast = (toast: {
    title: string;
    subtitle: string;
    smsPreview?: string;
  }) => {
    setLiveToast(toast);
    setTimeout(() => {
      setLiveToast((current) => (current === toast ? null : current));
    }, 6000);
  };

  const handleUpdateComplaintStatus = async (
    complaint: Complaint,
    newStatus: ComplaintStatus,
    notes?: string
  ) => {
    const loc = locations.find((l) => l.id === complaint.location_id);
    const assignedMgr = managers.find((m) => m.id === complaint.assigned_manager_id);

    const smsTemplate =
      newStatus === 'resolved'
        ? settings.sms_template_resolved
        : settings.sms_template_verified;

    const smsMessage = formatSmsMessage(smsTemplate, {
      guest: complaint.guest_name,
      ticket: complaint.ticket_number,
      location: loc?.name || 'Hotel Zone',
      room: complaint.room_number,
      department: assignedMgr?.department || 'Engineering & Maintenance',
    });

    const newSmsEntry = {
      timestamp: new Date().toISOString(),
      recipient: complaint.guest_phone || 'Guest Mobile',
      message: smsMessage,
      stage: newStatus === 'resolved' ? ('resolved' as const) : ('verified' as const),
    };

    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      sms_history: [...(complaint.sms_history || []), newSmsEntry],
    };

    if (newStatus === 'verified') {
      updatePayload.verified_at = new Date().toISOString();
      updatePayload.verified_by_id = currentUser?.id || null;
      if (notes) updatePayload.verification_notes = notes;
    } else if (newStatus === 'resolved') {
      updatePayload.resolved_at = new Date().toISOString();
      if (notes) updatePayload.resolution_notes = notes;
    } else if (notes) {
      updatePayload.verification_notes = notes;
    }

    await supabase.from('complaints').update(updatePayload).eq('id', complaint.id);
    await fetchAllData();

    showNotificationToast({
      title: `Updated ${complaint.ticket_number} (${loc?.code} — Room ${complaint.room_number})`,
      subtitle: `Status changed to ${newStatus.replace('_', ' ').toUpperCase()}.`,
      smsPreview: settings.enable_guest_sms ? smsMessage : undefined,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
        <div className="text-sm font-semibold text-slate-700">
          Loading Tangerine Beach Hotel Complaint Management System...
        </div>
      </div>
    );
  }

  const activeUnresolvedCount = complaints.filter(
    (c) => c.status !== 'resolved' && c.status !== 'rejected'
  ).length;

  return (
    <>
      {!currentUser ? (
        <LoginScreen
          managers={managers}
          settings={settings}
          onLogin={(mgr) => {
            setCurrentUser(mgr);
            showNotificationToast({
              title: `Signed in as ${mgr.full_name}`,
              subtitle:
                mgr.receive_all_complaints || mgr.role === 'super_manager'
                  ? 'Super Manager Mode: Viewing all complaints across the hotel.'
                  : `Dedicated Manager Mode: ${mgr.department}`,
            });
          }}
          onOpenGuestPortal={() => {
            setGuestModalLocation(locations.find((l) => l.code === 'BLK-04') || locations[0]);
            setGuestModalOpen(true);
          }}
          onOpenConfigModal={() => setConfigModalOpen(true)}
        />
      ) : (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
          {/* Shift Notice Banner */}
          {settings.show_login_notification_banner && settings.login_banner_message && (
            <div className="bg-slate-900 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-center gap-2">
              <BellRing className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>
                <strong>NOTICE:</strong> {settings.login_banner_message}
              </span>
            </div>
          )}

          {/* Main Header */}
          <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
              <HotelLogo
                logoUrl={settings.hotel_logo_url}
                size="md"
                darkText={false}
                subtitle="Customer Complaint & Heatmap Monitoring System"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGuestModalLocation(
                      locations.find((l) => l.code === 'BLK-04') || locations[0]
                    );
                    setGuestModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Guest QR Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-700 transition"
                >
                  <Settings className="w-4 h-4 text-slate-300" />
                  <span>Settings</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: currentUser.avatar_color }}
                  >
                    {currentUser.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <select
                    value={currentUser.id}
                    onChange={(e) => {
                      const found = managers.find((m) => m.id === e.target.value);
                      if (found) setCurrentUser(found);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.role === 'super_manager' ? 'Super Manager' : m.department})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setCurrentUser(null)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white border border-slate-700 transition"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveTab('map_heatmap')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'map_heatmap'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-4 h-4 text-orange-600" />
                <span>2D Hotel Map &amp; Heatmap</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('complaints_queue')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'complaints_queue'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <span>Complaints Queue</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold">
                  {activeUnresolvedCount} Open
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('visual_rules')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'visual_rules'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                <span>Assign Managers &amp; Rules</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('problem_builder')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'problem_builder'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Problem Categories</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('qr_configurator')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                  activeTab === 'qr_configurator'
                    ? 'border-slate-900 text-slate-900 bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>QR Code Configurator</span>
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
            {activeTab === 'map_heatmap' && (
              <HotelMap2DView
                locations={locations}
                complaints={complaints}
                categories={categories}
                managers={managers}
                rules={rules}
                interventions={interventions}
                currentUser={currentUser}
                onUpdateComplaintStatus={handleUpdateComplaintStatus}
                onOpenQrForLocation={(loc) => {
                  setGuestModalLocation(loc);
                  setGuestModalOpen(true);
                }}
                onRefreshData={fetchAllData}
              />
            )}

            {activeTab === 'complaints_queue' && (
              <ComplaintsQueueView
                complaints={complaints}
                locations={locations}
                categories={categories}
                managers={managers}
                currentUser={currentUser}
                onUpdateStatus={handleUpdateComplaintStatus}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'visual_rules' && (
              <VisualAssignmentAndRules
                managers={managers}
                categories={categories}
                locations={locations}
                rules={rules}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'problem_builder' && (
              <ProblemCategoriesManager
                categories={categories}
                managers={managers}
                onRefresh={fetchAllData}
              />
            )}

            {activeTab === 'qr_configurator' && (
              <QrConfiguratorView
                locations={locations}
                settings={settings}
                onSimulateScan={(loc) => {
                  setGuestModalLocation(loc);
                  setGuestModalOpen(true);
                }}
                onRefresh={fetchAllData}
              />
            )}
          </main>
        </div>
      )}

      {/* Notification Toast */}
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-full bg-slate-900 text-white rounded-xl p-4 shadow-xl border border-slate-700 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="font-bold text-sm text-white">{liveToast.title}</div>
            <button
              type="button"
              onClick={() => setLiveToast(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="text-xs text-slate-300">{liveToast.subtitle}</div>
          {liveToast.smsPreview && (
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-300">
              <div className="font-sans font-bold text-[10px] uppercase text-slate-300 mb-0.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>Guest SMS Dispatched:</span>
              </div>
              {liveToast.smsPreview}
            </div>
          )}
        </div>
      )}

      <GuestQrPortalModal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        initialLocation={guestModalLocation}
        locations={locations}
        categories={categories}
        managers={managers}
        rules={rules}
        settings={settings}
        onComplaintSubmitted={(createdComplaint, smsText) => {
          fetchAllData();
          const loc = locations.find((l) => l.id === createdComplaint.location_id);
          const mgr = managers.find((m) => m.id === createdComplaint.assigned_manager_id);
          showNotificationToast({
            title: `New Complaint: ${createdComplaint.ticket_number} (${loc?.code} • Room ${createdComplaint.room_number})`,
            subtitle: `Routed to ${mgr?.full_name || 'Department Manager'} + Super Manager notified.`,
            smsPreview: smsText,
          });
        }}
      />

      <NotificationAndLoginConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        settings={settings}
        onSettingsUpdated={(newSettings) => setSettings(newSettings)}
        managers={managers}
        onManagersUpdated={fetchAllData}
      />
    </>
  );
}
export default App;
