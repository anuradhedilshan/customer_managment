export type ZoneType = 'room_block' | 'outdoor' | 'public_area';
export type StaffRole = 'super_manager' | 'verification_officer' | 'department_manager';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintStatus = 'pending_verification' | 'verified' | 'in_progress' | 'resolved' | 'rejected';

export interface LocationZone {
  id: string;
  name: string;
  code: string;
  zone_type: ZoneType;
  room_range: string;
  map_x: number;
  map_y: number;
  description: string;
  active: boolean;
  created_at?: string;
}

export interface StaffManager {
  id: string;
  full_name: string;
  role: StaffRole;
  title: string;
  department: string;
  email: string;
  phone: string;
  pin_code: string;
  avatar_color: string;
  receive_all_complaints: boolean;
  notify_sms: boolean;
  notify_in_app: boolean;
  notify_sound: boolean;
  active: boolean;
  created_at?: string;
}

export interface ProblemCategory {
  id: string;
  name: string;
  code: string;
  icon: string;
  color: string;
  is_pest_related: boolean;
  requires_verification: boolean;
  default_severity: SeverityLevel;
  sub_issues: string[];
  default_manager_id: string | null;
  active: boolean;
  created_at?: string;
}

export interface RoutingRule {
  id: string;
  rule_name: string;
  category_id: string | null;
  location_id: string | null;
  min_severity: SeverityLevel;
  assigned_manager_id: string | null;
  cc_super_manager: boolean;
  auto_verify: boolean;
  trigger_mimic_alert: boolean;
  hotspot_threshold: number;
  priority_order: number;
  active: boolean;
  created_at?: string;
}

export interface SmsLogEntry {
  timestamp: string;
  recipient: string;
  message: string;
  stage: 'received' | 'verified' | 'resolved' | 'manager_alert';
}

export interface Complaint {
  id: string;
  ticket_number: string;
  location_id: string;
  room_number: string;
  guest_name: string;
  guest_phone: string;
  category_id: string;
  specific_issue: string;
  severity: SeverityLevel;
  description: string;
  image_url: string | null;
  status: ComplaintStatus;
  assigned_manager_id: string | null;
  verified_by_id: string | null;
  verification_notes: string;
  resolution_notes: string;
  sms_sent_to_guest: boolean;
  sms_history: SmsLogEntry[];
  created_at: string;
  verified_at: string | null;
  resolved_at: string | null;
}

export interface Intervention {
  id: string;
  location_id: string | null;
  title: string;
  department: string;
  performed_by: string;
  performed_at: string;
  notes: string;
  created_at?: string;
}

export interface SystemSettings {
  id: string;
  hotel_name: string;
  hotel_logo_url: string;
  enable_guest_sms: boolean;
  sms_sender_id: string;
  sms_template_received: string;
  sms_template_verified: string;
  sms_template_resolved: string;
  require_login_pin: boolean;
  show_login_notification_banner: boolean;
  login_banner_message: string;
  default_intervention_cutoff: string;
  updated_at?: string;
}
