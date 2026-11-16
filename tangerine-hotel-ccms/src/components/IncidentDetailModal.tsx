import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  Complaint,
  ComplaintStatus,
  LocationZone,
  ProblemCategory,
  StaffManager,
} from '../types';
import { supabase } from '../lib/supabase';
import { CategoryIcon } from './CategoryIcon';

interface IncidentDetailModalProps {
  complaint: Complaint | null;
  onClose: () => void;
  locations: LocationZone[];
  categories: ProblemCategory[];
  managers: StaffManager[];
  currentUser: StaffManager | null;
  onUpdateStatus: (
    complaint: Complaint,
    newStatus: ComplaintStatus,
    notes?: string
  ) => Promise<void>;
  onRefresh: () => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  complaint,
  onClose,
  locations,
  categories,
  managers,
  currentUser,
  onUpdateStatus,
  onRefresh,
}) => {
  const [actionNote, setActionNote] = useState('');
  const [zoomedImage, setZoomedImage] = useState(false);
  const [updating, setUpdating] = useState(false);

  if (!complaint) return null;

  const location = locations.find((l) => l.id === complaint.location_id);
  const category = categories.find((c) => c.id === complaint.category_id);
  const assignedManager = managers.find(
    (m) => m.id === complaint.assigned_manager_id
  );

  const handleStatusAction = async (newStatus: ComplaintStatus) => {
    setUpdating(true);
    try {
      await onUpdateStatus(
        complaint,
        newStatus,
        actionNote.trim() ||
          (newStatus === 'verified'
            ? `Verified by ${currentUser?.full_name || 'Staff'}`
            : newStatus === 'in_progress'
            ? `Dispatched ${assignedManager?.department || 'Maintenance Team'}`
            : 'Issue resolved & verified')
      );
      setActionNote('');
    } finally {
      setUpdating(false);
    }
  };

  const handleReassign = async (newManagerId: string) => {
    await supabase
      .from('complaints')
      .update({ assigned_manager_id: newManagerId || null })
      .eq('id', complaint.id);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-slate-300 overflow-hidden my-6">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: category?.color || '#ea580c' }}
            >
              <CategoryIcon name={category?.icon || 'Bug'} className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-orange-600 text-white">
                  {complaint.ticket_number}
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  Room {complaint.room_number}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                    complaint.status === 'resolved'
                      ? 'bg-emerald-600 text-white'
                      : complaint.status === 'in_progress'
                      ? 'bg-amber-500 text-slate-950'
                      : complaint.status === 'verified'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {complaint.status.replace('_', ' ')}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {complaint.specific_issue}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 max-h-[80vh] overflow-y-auto">
          {/* Left 6 Cols: Uploaded Incident Photo Evidence */}
          <div className="md:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-orange-600" />
                <span>Attached Guest Photo Evidence</span>
              </span>
              {complaint.image_url && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomedImage(!zoomedImage)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>{zoomedImage ? 'Fit Image' : 'Full Size'}</span>
                  </button>
                  <a
                    href={complaint.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Tab</span>
                  </a>
                </div>
              )}
            </div>

            {complaint.image_url ? (
              <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950 flex items-center justify-center">
                <img
                  src={complaint.image_url}
                  alt={`Incident ${complaint.ticket_number}`}
                  onClick={() => setZoomedImage(!zoomedImage)}
                  className={`w-full cursor-zoom-in transition-all ${
                    zoomedImage ? 'max-h-[520px] object-contain' : 'h-72 object-cover'
                  }`}
                />
              </div>
            ) : (
              <div className="h-64 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center p-6">
                <ImageIcon className="w-10 h-10 text-slate-300 mb-2" />
                <div className="text-sm font-bold text-slate-600">
                  No Photo Uploaded for This Incident
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  The guest submitted this complaint without attaching an optional photo.
                </p>
              </div>
            )}

            {/* Description Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-bold uppercase text-slate-500">
                Guest Complaint Description
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">
                {complaint.description || 'No additional description provided.'}
              </p>
            </div>
          </div>

          {/* Right 6 Cols: Metadata, Routing & Action Controls */}
          <div className="md:col-span-6 space-y-4">
            {/* Location & Guest Details Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Hotel Location Zone:</span>
                <span className="font-bold text-slate-900 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-orange-600" />
                  {location?.name} ({location?.code})
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Guest Room Number:</span>
                <span className="font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                  Room {complaint.room_number}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Guest Name &amp; Phone:</span>
                <span className="font-bold text-slate-800 inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {complaint.guest_name}
                  {complaint.guest_phone ? ` (${complaint.guest_phone})` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-medium">Category &amp; Severity:</span>
                <span className="font-bold text-slate-900 uppercase">
                  {category?.name} •{' '}
                  <span
                    className={
                      complaint.severity === 'critical'
                        ? 'text-red-600'
                        : complaint.severity === 'high'
                        ? 'text-orange-600'
                        : 'text-slate-700'
                    }
                  >
                    {complaint.severity}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Reported Timestamp:</span>
                <span className="text-slate-700 font-medium inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(complaint.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Assigned Responsible Manager */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
              <label className="block text-xs font-bold uppercase text-slate-600">
                Assigned Responsible Manager
              </label>
              <select
                value={complaint.assigned_manager_id || ''}
                onChange={(e) => handleReassign(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} — {m.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Verification / Resolution Notes History */}
            {(complaint.verification_notes || complaint.resolution_notes) && (
              <div className="space-y-2 text-xs">
                {complaint.verification_notes && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                    <strong>Verification Note:</strong> {complaint.verification_notes}
                  </div>
                )}
                {complaint.resolution_notes && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <strong>Resolution Note:</strong> {complaint.resolution_notes}
                  </div>
                )}
              </div>
            )}

            {/* Update Incident Status Controls */}
            {complaint.status !== 'resolved' ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-bold uppercase text-slate-700">
                  Take Action &amp; Notify Guest
                </div>
                <input
                  type="text"
                  placeholder="Enter verification or resolution note..."
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {complaint.status === 'pending_verification' && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleStatusAction('verified')}
                      className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                    >
                      Verify Incident
                    </button>
                  )}
                  {complaint.status !== 'in_progress' && (
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => handleStatusAction('in_progress')}
                      className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
                    >
                      Mark In Progress
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusAction('resolved')}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition ml-auto"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  This incident was resolved on{' '}
                  {complaint.resolved_at
                    ? new Date(complaint.resolved_at).toLocaleString()
                    : 'record'}
                  .
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
