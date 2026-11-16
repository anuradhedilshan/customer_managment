import { createClient } from '@supabase/supabase-js';
import type {
  ComplaintStatus,
  LocationZone,
  ProblemCategory,
  RoutingRule,
  SeverityLevel,
  StaffManager,
  SystemSettings,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qdhshmxcnheyflpbqooz.supabase.co';
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_bDh-O6w5uNmqqgDh0XYWyg_hXVms7VD';

export const supabase = createClient(supabaseUrl, supabaseKey);

const SEVERITY_RANK: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function evaluateRoutingForComplaint(params: {
  categoryId: string;
  locationId: string;
  severity: SeverityLevel;
  categories: ProblemCategory[];
  rules: RoutingRule[];
  managers: StaffManager[];
}): {
  assignedManagerId: string | null;
  initialStatus: ComplaintStatus;
  matchedRule: RoutingRule | null;
} {
  const { categoryId, locationId, severity, categories, rules, managers } = params;
  const category = categories.find((c) => c.id === categoryId);

  const sortedRules = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.priority_order - b.priority_order);

  const matchedRule =
    sortedRules.find((rule) => {
      const catMatch = !rule.category_id || rule.category_id === categoryId;
      const locMatch = !rule.location_id || rule.location_id === locationId;
      const sevMatch = SEVERITY_RANK[severity] >= SEVERITY_RANK[rule.min_severity || 'low'];
      return catMatch && locMatch && sevMatch;
    }) || null;

  let assignedManagerId =
    matchedRule?.assigned_manager_id ||
    category?.default_manager_id ||
    managers.find((m) => m.role === 'super_manager')?.id ||
    null;

  const shouldAutoVerify =
    matchedRule?.auto_verify || (category ? !category.requires_verification : false);

  return {
    assignedManagerId,
    initialStatus: shouldAutoVerify ? 'verified' : 'pending_verification',
    matchedRule,
  };
}

export function formatSmsMessage(
  template: string,
  data: {
    guest: string;
    ticket: string;
    location: string;
    room: string;
    department: string;
  }
): string {
  return template
    .replace(/\{guest\}/g, data.guest || 'Valued Guest')
    .replace(/\{ticket\}/g, data.ticket)
    .replace(/\{location\}/g, data.location)
    .replace(/\{room\}/g, data.room)
    .replace(/\{department\}/g, data.department);
}

export async function uploadComplaintImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `complaint_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `guest-uploads/${fileName}`;

  const { error } = await supabase.storage
    .from('complaint-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('complaint-images').getPublicUrl(filePath);
  return data.publicUrl;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  id: 'default',
  hotel_name: 'Tangerine Beach Hotel, Kalutara',
  hotel_logo_url: 'https://www.tangerinehotels.com/tangerinebeachhotel/wp-content/uploads/sites/2/2022/12/logo.png',
  enable_guest_sms: true,
  sms_sender_id: 'TANGERINE',
  sms_template_received:
    'Dear {guest}, your complaint ({ticket}) at {location} (Room {room}) has been received by Tangerine Beach Hotel Customer Care.',
  sms_template_verified:
    'Update ({ticket}): Our officer has verified your report at {location} and assigned {department} for immediate action.',
  sms_template_resolved:
    'Resolved ({ticket}): The reported issue at {location} (Room {room}) has been resolved. Thank you for staying at Tangerine Beach Hotel!',
  require_login_pin: true,
  show_login_notification_banner: true,
  login_banner_message:
    'Evening mosquito fogging & larvicide inspection scheduled for Block 04 & Block 06 outdoor corridors at 17:30 hrs.',
  default_intervention_cutoff: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
};

export function getLocationLedState(
  location: LocationZone,
  complaints: { location_id: string; status: ComplaintStatus; category_id: string }[],
  categories: ProblemCategory[],
  pestOnly: boolean
): {
  state: 'red' | 'amber' | 'green' | 'idle';
  unresolvedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  totalCount: number;
} {
  const filtered = complaints.filter((c) => {
    if (c.location_id !== location.id) return false;
    if (pestOnly) {
      const cat = categories.find((catItem) => catItem.id === c.category_id);
      return Boolean(cat?.is_pest_related);
    }
    return true;
  });

  const unresolved = filtered.filter(
    (c) => c.status === 'pending_verification' || c.status === 'verified' || c.status === 'in_progress'
  );
  const inProgress = filtered.filter((c) => c.status === 'in_progress');
  const resolved = filtered.filter((c) => c.status === 'resolved');

  let state: 'red' | 'amber' | 'green' | 'idle' = 'idle';
  if (unresolved.length > 0) {
    state = 'red';
  } else if (resolved.length > 0) {
    state = 'green';
  }

  return {
    state,
    unresolvedCount: unresolved.length,
    inProgressCount: inProgress.length,
    resolvedCount: resolved.length,
    totalCount: filtered.length,
  };
}
