import React, { useState } from 'react';
import { Bell, Check, Lock, MessageSquare, Save, Shield, Volume2, X } from 'lucide-react';
import type { StaffManager, SystemSettings } from '../types';
import { supabase } from '../lib/supabase';

interface NotificationAndLoginConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SystemSettings;
  onSettingsUpdated: (newSettings: SystemSettings) => void;
  managers: StaffManager[];
  onManagersUpdated: () => void;
}

export const NotificationAndLoginConfigModal: React.FC<
  NotificationAndLoginConfigModalProps
> = ({
  isOpen,
  onClose,
  settings,
  onSettingsUpdated,
  managers,
  onManagersUpdated,
}) => {
  const [formData, setFormData] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          ...formData,
          id: 'default',
          updated_at: new Date().toISOString(),
        });

      if (!error) {
        onSettingsUpdated(formData);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleManagerNotification = async (
    manager: StaffManager,
    field: 'notify_sms' | 'notify_in_app' | 'notify_sound'
  ) => {
    await supabase
      .from('staff_managers')
      .update({ [field]: !manager[field] })
      .eq('id', manager.id);
    onManagersUpdated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Login &amp; Notification Configuration
              </h3>
              <p className="text-xs text-slate-300">
                Configure staff login rules, notice banner, and Guest SMS notification templates
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Login Configuration */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Lock className="w-4 h-4 text-slate-700" />
              <span>1. Staff Login &amp; Notice Banner Settings</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Require 4-Digit PIN
                  </div>
                  <div className="text-xs text-slate-500">
                    Verify staff PIN code on login
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.require_login_pin}
                  onChange={(e) =>
                    setFormData({ ...formData, require_login_pin: e.target.checked })
                  }
                  className="w-4 h-4 accent-slate-900 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 cursor-pointer">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Show Notice Banner
                  </div>
                  <div className="text-xs text-slate-500">
                    Display operations notice at top of screen
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.show_login_notification_banner}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      show_login_notification_banner: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-slate-900 rounded"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Notice Banner Message
              </label>
              <input
                type="text"
                value={formData.login_banner_message}
                onChange={(e) =>
                  setFormData({ ...formData, login_banner_message: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>

          {/* Section 2: Guest SMS Notification Facility */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <MessageSquare className="w-4 h-4 text-slate-700" />
                <span>2. Guest SMS Notification Settings</span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enable_guest_sms}
                  onChange={(e) =>
                    setFormData({ ...formData, enable_guest_sms: e.target.checked })
                  }
                  className="w-4 h-4 accent-slate-900 rounded"
                />
                <span>Enable Automated Guest SMS</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SMS Sender ID
                </label>
                <input
                  type="text"
                  value={formData.sms_sender_id}
                  onChange={(e) =>
                    setFormData({ ...formData, sms_sender_id: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Hotel Brand Logo URL
                </label>
                <input
                  type="text"
                  value={formData.hotel_logo_url}
                  onChange={(e) =>
                    setFormData({ ...formData, hotel_logo_url: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SMS Template — On Complaint Submission
                </label>
                <textarea
                  rows={2}
                  value={formData.sms_template_received}
                  onChange={(e) =>
                    setFormData({ ...formData, sms_template_received: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SMS Template — On Officer Verification
                </label>
                <textarea
                  rows={2}
                  value={formData.sms_template_verified}
                  onChange={(e) =>
                    setFormData({ ...formData, sms_template_verified: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SMS Template — On Issue Resolution
                </label>
                <textarea
                  rows={2}
                  value={formData.sms_template_resolved}
                  onChange={(e) =>
                    setFormData({ ...formData, sms_template_resolved: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Manager Alert Channels */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Shield className="w-4 h-4 text-slate-700" />
              <span>3. Manager Notification Preferences</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
              {managers.map((m) => (
                <div
                  key={m.id}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{m.full_name}</span>{' '}
                    <span className="text-slate-500">({m.department})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleManagerNotification(m, 'notify_sms')}
                      className={`px-2.5 py-1 rounded font-semibold border transition ${
                        m.notify_sms
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      SMS Alert
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleManagerNotification(m, 'notify_in_app')}
                      className={`px-2.5 py-1 rounded font-semibold border transition ${
                        m.notify_in_app
                          ? 'bg-blue-50 border-blue-300 text-blue-700'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      In-App Popup
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleManagerNotification(m, 'notify_sound')}
                      className={`px-2.5 py-1 rounded font-semibold border inline-flex items-center gap-1 transition ${
                        m.notify_sound
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                    >
                      <Volume2 className="w-3 h-3" />
                      Sound
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-2">
            {savedToast ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <Check className="w-4 h-4" />
                Saved to Supabase!
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                Placeholders: {'{guest}'}, {'{ticket}'}, {'{location}'}, {'{room}'}, {'{department}'}
              </span>
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
