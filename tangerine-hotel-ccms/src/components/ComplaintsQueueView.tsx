import React, { useMemo, useState } from 'react';
import {
  Clock,
  Eye,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Search,
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

interface ComplaintsQueueViewProps {
  complaints: Complaint[];
  locations: LocationZone[];
  categories: ProblemCategory[];
  managers: StaffManager[];
  currentUser: StaffManager;
  onUpdateStatus: (
    complaint: Complaint,
    newStatus: ComplaintStatus,
    notes?: string
  ) => Promise<void>;
  onSelectComplaint: (complaint: Complaint) => void;
  onRefresh: () => void;
}

export const ComplaintsQueueView: React.FC<ComplaintsQueueViewProps> = ({
  complaints,
  locations,
  categories,
  managers,
  currentUser,
  onUpdateStatus,
  onSelectComplaint,
  onRefresh,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'my_scope' | 'all'>(
    currentUser.receive_all_complaints ||
      currentUser.role === 'super_manager' ||
      currentUser.role === 'verification_officer'
      ? 'all'
      : 'my_scope'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [notesByTicket, setNotesByTicket] = useState<Record<string, string>>({});

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (
        scopeFilter === 'my_scope' &&
        !currentUser.receive_all_complaints &&
        currentUser.role !== 'super_manager'
      ) {
        if (c.assigned_manager_id !== currentUser.id) return false;
      }
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const loc = locations.find((l) => l.id === c.location_id);
        const match =
          c.ticket_number.toLowerCase().includes(q) ||
          c.room_number.toLowerCase().includes(q) ||
          c.guest_name.toLowerCase().includes(q) ||
          c.specific_issue.toLowerCase().includes(q) ||
          (loc?.name.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });
  }, [complaints, scopeFilter, currentUser, statusFilter, searchQuery, locations]);

  const handleReassignManager = async (complaintId: string, newManagerId: string) => {
    await supabase
      .from('complaints')
      .update({ assigned_manager_id: newManagerId || null })
      .eq('id', complaintId);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                scopeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Complaints ({complaints.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('my_scope')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                scopeFilter === 'my_scope'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Assigned to {currentUser.full_name.split(' ')[0]}
            </button>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search room no, ticket, block, guest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-4 py-1.5 text-xs"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredComplaints.map((c) => {
          const loc = locations.find((l) => l.id === c.location_id);
          const cat = categories.find((catItem) => catItem.id === c.category_id);
          const assignedMgr = managers.find((m) => m.id === c.assigned_manager_id);

          return (
            <div
              key={c.id}
              className="bg-white rounded-xl p-5 border border-slate-200 hover:border-slate-400 transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div
                  onClick={() => onSelectComplaint(c)}
                  className="flex items-start gap-3.5 max-w-2xl cursor-pointer flex-1"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5"
                    style={{ backgroundColor: cat?.color || '#ea580c' }}
                  >
                    <CategoryIcon name={cat?.icon || 'Bug'} className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {c.ticket_number}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                        Room {c.room_number}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {loc?.name} ({loc?.code})
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 pt-0.5 hover:text-orange-600">
                      {c.specific_issue}
                    </h4>

                    {c.description && (
                      <p className="text-xs text-slate-600">{c.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
                      <span>
                        Guest: <strong className="text-slate-800">{c.guest_name}</strong> (
                        {c.guest_phone || 'N/A'})
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                      {c.sms_sent_to_guest && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <MessageSquare className="w-3.5 h-3.5" />
                          SMS Active
                        </span>
                      )}
                    </div>
                  </div>

                  {c.image_url && (
                    <div className="w-24 h-20 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group">
                      <img
                        src={c.image_url}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold">
                        View Photo
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase ${
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

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Assigned:</span>
                    <select
                      value={c.assigned_manager_id || ''}
                      onChange={(e) => handleReassignManager(c.id, e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                    >
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.department})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectComplaint(c)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>
                      {c.image_url ? 'Open Incident & View Photo' : 'Open Incident Details'}
                    </span>
                  </button>

                  {c.verification_notes && (
                    <span className="text-xs text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                      <strong>Verification:</strong> {c.verification_notes}
                    </span>
                  )}
                  {c.resolution_notes && (
                    <span className="text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      <strong>Resolution:</strong> {c.resolution_notes}
                    </span>
                  )}
                </div>

                {c.status !== 'resolved' && (
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <input
                      type="text"
                      placeholder="Note..."
                      value={notesByTicket[c.id] || ''}
                      onChange={(e) =>
                        setNotesByTicket({ ...notesByTicket, [c.id]: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs w-48"
                    />
                    {c.status === 'pending_verification' && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            c,
                            'verified',
                            notesByTicket[c.id] || `Verified by ${currentUser.full_name}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                      >
                        Verify
                      </button>
                    )}
                    {c.status !== 'in_progress' && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateStatus(
                            c,
                            'in_progress',
                            notesByTicket[c.id] ||
                              `Dispatched ${assignedMgr?.department || 'Maintenance'}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                      >
                        In Progress
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStatus(
                          c,
                          'resolved',
                          notesByTicket[c.id] ||
                            'Issue resolved & guest notified via SMS'
                        )
                      }
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
