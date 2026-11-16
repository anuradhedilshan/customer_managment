import React, { useEffect, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import type {
  Complaint,
  LocationZone,
  ProblemCategory,
  RoutingRule,
  SeverityLevel,
  StaffManager,
  SystemSettings,
} from '../types';
import {
  evaluateRoutingForComplaint,
  formatSmsMessage,
  supabase,
  uploadComplaintImage,
} from '../lib/supabase';
import { CategoryIcon } from './CategoryIcon';
import { HotelLogo } from './HotelLogo';

interface GuestQrPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLocation: LocationZone | null;
  locations: LocationZone[];
  categories: ProblemCategory[];
  managers: StaffManager[];
  rules: RoutingRule[];
  settings: SystemSettings;
  onComplaintSubmitted: (complaint: Complaint, smsText: string) => void;
}

export const GuestQrPortalModal: React.FC<GuestQrPortalModalProps> = ({
  isOpen,
  onClose,
  initialLocation,
  locations,
  categories,
  managers,
  rules,
  settings,
  onComplaintSubmitted,
}) => {
  const [locationId, setLocationId] = useState<string>(
    initialLocation?.id || locations[0]?.id || ''
  );
  const [roomNumber, setRoomNumber] = useState<string>('414');
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('+94 77 ');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ''
  );
  const [specificIssue, setSpecificIssue] = useState<string>('');
  const [severity, setSeverity] = useState<SeverityLevel>('high');
  const [description, setDescription] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedTicket, setSubmittedTicket] = useState<{
    complaint: Complaint;
    assignedManager: StaffManager | undefined;
    superManager: StaffManager | undefined;
    smsMessage: string;
  } | null>(null);

  useEffect(() => {
    if (initialLocation) {
      setLocationId(initialLocation.id);
    } else if (!locationId && locations[0]) {
      setLocationId(locations[0].id);
    }
  }, [initialLocation, locations, locationId]);

  const activeCategory =
    categories.find((c) => c.id === selectedCategoryId) || categories[0];

  useEffect(() => {
    if (activeCategory) {
      setSeverity(activeCategory.default_severity || 'medium');
      if (activeCategory.sub_issues?.length > 0) {
        setSpecificIssue(activeCategory.sub_issues[0]);
      } else {
        setSpecificIssue(activeCategory.name);
      }
    }
  }, [selectedCategoryId, activeCategory]);

  if (!isOpen) return null;

  const selectedLocation =
    locations.find((l) => l.id === locationId) || locations[0];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !activeCategory || !roomNumber.trim()) return;

    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = imagePreviewUrl;
      if (imageFile) {
        uploadedImageUrl = await uploadComplaintImage(imageFile);
      }

      const ticketNumber = `TBH-${Math.floor(2420 + Math.random() * 7500)}`;

      const routing = evaluateRoutingForComplaint({
        categoryId: activeCategory.id,
        locationId: selectedLocation.id,
        severity,
        categories,
        rules,
        managers,
      });

      const assignedManager = managers.find(
        (m) => m.id === routing.assignedManagerId
      );
      const superManager = managers.find(
        (m) => m.role === 'super_manager' || m.receive_all_complaints
      );

      const smsText = formatSmsMessage(settings.sms_template_received, {
        guest: guestName.trim() || 'Valued Guest',
        ticket: ticketNumber,
        location: selectedLocation.name,
        room: roomNumber.trim(),
        department: assignedManager?.department || 'Customer Care',
      });

      const smsHistory = [
        {
          timestamp: new Date().toISOString(),
          recipient: guestPhone.trim() || 'Guest Mobile',
          message: smsText,
          stage: 'received' as const,
        },
      ];

      const { data, error } = await supabase
        .from('complaints')
        .insert({
          ticket_number: ticketNumber,
          location_id: selectedLocation.id,
          room_number: roomNumber.trim(),
          guest_name: guestName.trim() || 'Hotel Guest',
          guest_phone: guestPhone.trim(),
          category_id: activeCategory.id,
          specific_issue: specificIssue || activeCategory.name,
          severity,
          description: description.trim(),
          image_url: uploadedImageUrl,
          status: routing.initialStatus,
          assigned_manager_id: routing.assignedManagerId,
          sms_sent_to_guest: settings.enable_guest_sms,
          sms_history: smsHistory,
        })
        .select('*')
        .single();

      if (error) throw error;

      const createdComplaint = data as Complaint;
      setSubmittedTicket({
        complaint: createdComplaint,
        assignedManager,
        superManager,
        smsMessage: smsText,
      });
      onComplaintSubmitted(createdComplaint, smsText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setDescription('');
    setImageFile(null);
    setImagePreviewUrl(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-300 overflow-hidden my-4 relative">
        {/* Top Bar */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <HotelLogo
            logoUrl={settings.hotel_logo_url}
            size="sm"
            darkText={false}
            subtitle="Guest QR Complaint Submission"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scanned QR Location Badge */}
        <div className="bg-orange-600 text-white px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <QrCode className="w-4 h-4 shrink-0" />
            <div className="text-xs font-bold truncate">
              Location: {selectedLocation?.name} ({selectedLocation?.code})
            </div>
          </div>
          <MapPin className="w-4 h-4 shrink-0" />
        </div>

        {submittedTicket ? (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-xs font-bold">
                Ticket #{submittedTicket.complaint.ticket_number}
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Complaint Submitted
              </h3>
              <p className="text-xs text-slate-500">
                The 2D Hotel Heatmap has been updated for{' '}
                <strong>{selectedLocation?.name}</strong>.
              </p>
            </div>

            {settings.enable_guest_sms && (
              <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    SMS Sent to Guest ({submittedTicket.complaint.guest_phone || 'Mobile'})
                  </span>
                  <span>Sender: {settings.sms_sender_id}</span>
                </div>
                <p className="text-xs text-slate-200 font-mono bg-slate-800 p-2.5 rounded-lg">
                  {submittedTicket.smsMessage}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>Routing Summary</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Room / Location:</span>
                <span className="font-bold text-slate-800">
                  Room {submittedTicket.complaint.room_number} • {selectedLocation?.code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dedicated Manager:</span>
                <span className="font-bold text-orange-700">
                  {submittedTicket.assignedManager?.full_name || 'Customer Care Officer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Super Manager CC:</span>
                <span className="font-bold text-slate-800">
                  {submittedTicket.superManager?.full_name || 'Director / Head of Engineering'}
                </span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Submit Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                View on Heatmap
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="p-5 space-y-4 max-h-[75vh] overflow-y-auto"
          >
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                QR Location Zone
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code}) — {loc.room_range}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 412"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Guest Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Mobile Number (For SMS Updates)
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="+94 77 123 4567"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">
                Complaint Category *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categories
                  .filter((c) => c.active)
                  .map((cat) => {
                    const isSelected = cat.id === activeCategory?.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className={`p-2.5 rounded-lg border text-left transition flex items-start gap-2 ${
                          isSelected
                            ? 'bg-orange-50 border-orange-600'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: cat.color }}
                        >
                          <CategoryIcon name={cat.icon} className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">
                            {cat.name}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {activeCategory && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Specific Issue
                </label>
                <select
                  value={specificIssue}
                  onChange={(e) => setSpecificIssue(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                >
                  {activeCategory.sub_issues?.map((issue) => (
                    <option key={issue} value={issue}>
                      {issue}
                    </option>
                  ))}
                  <option value={`Other ${activeCategory.name} Issue`}>
                    Other / Custom Issue
                  </option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Severity Level
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['low', 'medium', 'high', 'critical'] as SeverityLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverity(lvl)}
                    className={`py-1.5 rounded-lg text-xs font-bold uppercase border transition ${
                      severity === lvl
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Describe the issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Optional Image Upload (Supabase Storage)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-slate-500 bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700">
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>{imageFile ? imageFile.name : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {!imagePreviewUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setImagePreviewUrl(
                        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold shrink-0"
                    title="Attach sample photo"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                )}
              </div>
              {imagePreviewUrl && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 h-28">
                  <img
                    src={imagePreviewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreviewUrl(null);
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900 text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Complaint</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
