import React, { useState } from 'react';
import {
  ArrowRight,
  Crown,
  GitBranch,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type {
  LocationZone,
  ProblemCategory,
  RoutingRule,
  SeverityLevel,
  StaffManager,
  StaffRole,
} from '../types';
import { supabase } from '../lib/supabase';
import { CategoryIcon } from './CategoryIcon';

interface VisualAssignmentAndRulesProps {
  managers: StaffManager[];
  categories: ProblemCategory[];
  locations: LocationZone[];
  rules: RoutingRule[];
  onRefresh: () => void;
}

export const VisualAssignmentAndRules: React.FC<VisualAssignmentAndRulesProps> = ({
  managers,
  categories,
  locations,
  rules,
  onRefresh,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    categories[0]?.id || ''
  );

  const [ruleName, setRuleName] = useState('');
  const [ruleCatId, setRuleCatId] = useState<string>(categories[0]?.id || '');
  const [ruleLocId, setRuleLocId] = useState<string>('');
  const [ruleMinSeverity, setRuleMinSeverity] = useState<SeverityLevel>('low');
  const [ruleManagerId, setRuleManagerId] = useState<string>(
    managers.find((m) => m.role === 'department_manager')?.id || managers[0]?.id || ''
  );
  const [ruleAutoVerify, setRuleAutoVerify] = useState<boolean>(false);
  const [ruleHotspotThreshold, setRuleHotspotThreshold] = useState<number>(2);

  const [showAddManagerModal, setShowAddManagerModal] = useState(false);
  const [mgrName, setMgrName] = useState('');
  const [mgrTitle, setMgrTitle] = useState('');
  const [mgrDept, setMgrDept] = useState('Engineering Department');
  const [mgrRole, setMgrRole] = useState<StaffRole>('department_manager');
  const [mgrEmail, setMgrEmail] = useState('');
  const [mgrPhone, setMgrPhone] = useState('+94 77 ');
  const [mgrPin, setMgrPin] = useState('7777');
  const [mgrReceiveAll, setMgrReceiveAll] = useState(false);

  const superManagers = managers.filter(
    (m) => m.role === 'super_manager' || m.receive_all_complaints
  );
  const dedicatedManagers = managers.filter(
    (m) => m.role !== 'super_manager' && !m.receive_all_complaints
  );

  const handleVisualAssignCategoryToManager = async (
    categoryId: string,
    managerId: string
  ) => {
    await supabase
      .from('problem_categories')
      .update({ default_manager_id: managerId })
      .eq('id', categoryId);

    const existingRule = rules.find(
      (r) => r.category_id === categoryId && !r.location_id
    );
    if (existingRule) {
      await supabase
        .from('routing_rules')
        .update({ assigned_manager_id: managerId })
        .eq('id', existingRule.id);
    }
    onRefresh();
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === ruleCatId);
    const mgr = managers.find((m) => m.id === ruleManagerId);
    const loc = locations.find((l) => l.id === ruleLocId);

    const generatedName =
      ruleName.trim() ||
      `${cat?.name || 'All Categories'} ${loc ? `@ ${loc.code}` : '(All Zones)'} → ${
        mgr?.full_name || 'Manager'
      }`;

    await supabase.from('routing_rules').insert({
      rule_name: generatedName,
      category_id: ruleCatId || null,
      location_id: ruleLocId || null,
      min_severity: ruleMinSeverity,
      assigned_manager_id: ruleManagerId || null,
      cc_super_manager: true,
      auto_verify: ruleAutoVerify,
      trigger_mimic_alert: true,
      hotspot_threshold: ruleHotspotThreshold,
      priority_order: rules.length + 1,
      active: true,
    });

    setRuleName('');
    onRefresh();
  };

  const handleDeleteRule = async (ruleId: string) => {
    await supabase.from('routing_rules').delete().eq('id', ruleId);
    onRefresh();
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mgrName.trim() || !mgrEmail.trim()) return;
    await supabase.from('staff_managers').insert({
      full_name: mgrName.trim(),
      role: mgrRole,
      title: mgrTitle.trim() || 'Department Manager',
      department: mgrDept.trim(),
      email: mgrEmail.trim(),
      phone: mgrPhone.trim(),
      pin_code: mgrPin.trim() || '1234',
      avatar_color: mgrRole === 'super_manager' ? '#ea580c' : '#0284c7',
      receive_all_complaints: mgrRole === 'super_manager' ? true : mgrReceiveAll,
      notify_sms: true,
      notify_in_app: true,
      notify_sound: true,
      active: true,
    });
    setMgrName('');
    setMgrTitle('');
    setMgrEmail('');
    setShowAddManagerModal(false);
    onRefresh();
  };

  const selectedCatObj = categories.find((c) => c.id === selectedCategoryId);

  return (
    <div className="space-y-6">
      {/* Top Banner: Super Manager Global Oversight */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-amber-400">
                Super Manager Oversight
              </div>
              <h3 className="text-lg font-bold">
                Super Manager Receives All Hotel Complaints
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Dedicated managers receive their assigned categories, while the Super Manager
                automatically receives all complaints across every hotel location.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddManagerModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Responsible Manager</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-800">
          {superManagers.map((sm) => (
            <div
              key={sm.id}
              className="p-4 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                  style={{ backgroundColor: sm.avatar_color }}
                >
                  {sm.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div>
                  <div className="font-bold text-sm text-white flex items-center gap-2">
                    <span>{sm.full_name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-400 text-slate-950 font-bold">
                      SUPER MANAGER
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {sm.title} • {sm.department}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-semibold">
                Receives All Complaints
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Assignment Board */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Visually Assign Problem Categories to Responsible Managers
            </h3>
            <p className="text-xs text-slate-500">
              Step 1: Select a <strong>Problem Category</strong> on the left → Step 2: Click a{' '}
              <strong>Dedicated Manager</strong> on the right to assign.
            </p>
          </div>
          {selectedCatObj && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800">
              Selected: {selectedCatObj.name}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left 5 Cols */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">
              1. Problem Categories ({categories.length})
            </div>
            {categories.map((cat) => {
              const isSelected = cat.id === selectedCategoryId;
              const assignedMgr = managers.find((m) => m.id === cat.default_manager_id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full p-3 rounded-lg border text-left transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-orange-50 border-orange-600'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <CategoryIcon name={cat.icon} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {cat.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Assigned:{' '}
                        <strong className="text-slate-800">
                          {assignedMgr?.full_name || 'Super Manager'}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-orange-600' : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Center 2 Cols */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center text-center py-2">
            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-1.5 border border-slate-200">
              <GitBranch className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-slate-700">Routes To</div>
          </div>

          {/* Right 5 Cols */}
          <div className="lg:col-span-5 space-y-2">
            <div className="text-xs font-bold uppercase text-slate-500 mb-2">
              2. Dedicated Managers ({dedicatedManagers.length})
            </div>
            {dedicatedManagers.map((mgr) => {
              const assignedCats = categories.filter(
                (c) => c.default_manager_id === mgr.id
              );
              const isAssignedToSelected =
                selectedCatObj?.default_manager_id === mgr.id;

              return (
                <div
                  key={mgr.id}
                  onClick={() => {
                    if (selectedCategoryId) {
                      handleVisualAssignCategoryToManager(selectedCategoryId, mgr.id);
                    }
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition ${
                    isAssignedToSelected
                      ? 'bg-emerald-50 border-emerald-600'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0"
                        style={{ backgroundColor: mgr.avatar_color }}
                      >
                        {mgr.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {mgr.full_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {mgr.title} • {mgr.department}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isAssignedToSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isAssignedToSelected ? 'Assigned' : 'Assign'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                    {assignedCats.length === 0 ? (
                      <span className="text-[11px] text-slate-400">
                        No default categories assigned
                      </span>
                    ) : (
                      assignedCats.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold"
                        >
                          <CategoryIcon name={c.icon} className="w-3 h-3" />
                          <span>{c.name}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conditional Routing & Hotspot Threshold Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Add Routing &amp; Hotspot Rule
            </h3>
            <p className="text-xs text-slate-500">
              Configure zone routing and the complaint threshold that flags a zone as a Hotspot on
              the 2D Heatmap.
            </p>
          </div>

          <form onSubmit={handleCreateRule} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Rule Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Block 04 Pest Hotspot Escalation"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Category
                </label>
                <select
                  value={ruleCatId}
                  onChange={(e) => setRuleCatId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">Any Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Hotel Location
                </label>
                <select
                  value={ruleLocId}
                  onChange={(e) => setRuleLocId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                >
                  <option value="">All Hotel Locations</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Min Severity
                </label>
                <select
                  value={ruleMinSeverity}
                  onChange={(e) => setRuleMinSeverity(e.target.value as SeverityLevel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase"
                >
                  <option value="low">Low &amp; Above</option>
                  <option value="medium">Medium &amp; Above</option>
                  <option value="high">High &amp; Critical</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Hotspot Threshold
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={ruleHotspotThreshold}
                  onChange={(e) => setRuleHotspotThreshold(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Assign Responsible Manager
              </label>
              <select
                value={ruleManagerId}
                onChange={(e) => setRuleManagerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
              >
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.department})
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={ruleAutoVerify}
                onChange={(e) => setRuleAutoVerify(e.target.checked)}
                className="w-4 h-4 accent-slate-900"
              />
              <span>Auto-Verify Immediately (Skip manual officer check)</span>
            </label>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Save Rule</span>
            </button>
          </form>
        </div>

        {/* Active Rules List */}
        <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Configured Routing &amp; Hotspot Rules ({rules.length})
            </h3>
          </div>

          <div className="space-y-3">
            {rules.map((rule) => {
              const cat = categories.find((c) => c.id === rule.category_id);
              const loc = locations.find((l) => l.id === rule.location_id);
              const mgr = managers.find((m) => m.id === rule.assigned_manager_id);

              return (
                <div
                  key={rule.id}
                  className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {rule.rule_name}
                      </span>
                      {rule.auto_verify && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Auto-Verify
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                      <span>
                        Category: <strong>{cat?.name || 'All Categories'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Zone: <strong>{loc?.name || 'All Hotel Zones'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Hotspot Trigger: <strong>≥ {rule.hotspot_threshold} reports</strong>
                      </span>
                    </div>
                    <div className="text-xs text-slate-800 font-semibold">
                      Assigned: {mgr?.full_name} ({mgr?.department}) + CC Super Manager
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Manager Modal */}
      {showAddManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Add Responsible Manager
            </h3>
            <form onSubmit={handleCreateManager} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sampath De Silva"
                  value={mgrName}
                  onChange={(e) => setMgrName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="F&B Manager"
                    value={mgrTitle}
                    onChange={(e) => setMgrTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Department *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Food & Beverage"
                    value={mgrDept}
                    onChange={(e) => setMgrDept(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    System Role
                  </label>
                  <select
                    value={mgrRole}
                    onChange={(e) => setMgrRole(e.target.value as StaffRole)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="department_manager">Dedicated Manager</option>
                    <option value="verification_officer">Verification Officer</option>
                    <option value="super_manager">Super Manager (All)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    4-Digit PIN
                  </label>
                  <input
                    type="text"
                    value={mgrPin}
                    onChange={(e) => setMgrPin(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="staff@tangerinehotels.com"
                    value={mgrEmail}
                    onChange={(e) => setMgrEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={mgrPhone}
                    onChange={(e) => setMgrPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={mgrReceiveAll}
                  onChange={(e) => setMgrReceiveAll(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"
                />
                <span>Also receive all hotel complaints (Super Manager access)</span>
              </label>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddManagerModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
                >
                  Add Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
