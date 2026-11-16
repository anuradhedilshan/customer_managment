import React, { useState } from 'react';
import {
  Bug,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { ProblemCategory, SeverityLevel, StaffManager } from '../types';
import { supabase } from '../lib/supabase';
import { AVAILABLE_CATEGORY_ICONS, CategoryIcon } from './CategoryIcon';

interface ProblemCategoriesManagerProps {
  categories: ProblemCategory[];
  managers: StaffManager[];
  onRefresh: () => void;
}

export const ProblemCategoriesManager: React.FC<ProblemCategoriesManagerProps> = ({
  categories,
  managers,
  onRefresh,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [icon, setIcon] = useState('Bug');
  const [color, setColor] = useState('#dc2626');
  const [isPestRelated, setIsPestRelated] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [defaultSeverity, setDefaultSeverity] = useState<SeverityLevel>('high');
  const [defaultManagerId, setDefaultManagerId] = useState<string>(
    managers.find((m) => m.role === 'department_manager')?.id || ''
  );
  const [subIssuesText, setSubIssuesText] = useState(
    'Mosquitoes in guest room\nFlies in outdoor area\nPreventive spray request'
  );
  const [newSubIssueByCat, setNewSubIssueByCat] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const cleanCode =
        code.trim().toUpperCase() ||
        name
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, '-')
          .slice(0, 12);

      const subIssues = subIssuesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await supabase.from('problem_categories').insert({
        name: name.trim(),
        code: cleanCode,
        icon,
        color,
        is_pest_related: isPestRelated,
        requires_verification: requiresVerification,
        default_severity: defaultSeverity,
        sub_issues: subIssues.length > 0 ? subIssues : [name.trim()],
        default_manager_id: defaultManagerId || null,
        active: true,
      });

      setName('');
      setCode('');
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleFlag = async (
    cat: ProblemCategory,
    field: 'is_pest_related' | 'requires_verification' | 'active'
  ) => {
    await supabase
      .from('problem_categories')
      .update({ [field]: !cat[field] })
      .eq('id', cat.id);
    onRefresh();
  };

  const handleAddSubIssue = async (cat: ProblemCategory) => {
    const text = (newSubIssueByCat[cat.id] || '').trim();
    if (!text) return;
    const updated = [...(cat.sub_issues || []), text];
    await supabase
      .from('problem_categories')
      .update({ sub_issues: updated })
      .eq('id', cat.id);
    setNewSubIssueByCat({ ...newSubIssueByCat, [cat.id]: '' });
    onRefresh();
  };

  const handleRemoveSubIssue = async (cat: ProblemCategory, issueToRemove: string) => {
    const updated = (cat.sub_issues || []).filter((i) => i !== issueToRemove);
    await supabase
      .from('problem_categories')
      .update({ sub_issues: updated })
      .eq('id', cat.id);
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 Cols: Create New Problem Category Form */}
      <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-slate-200 space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Create &amp; Add Problem Category
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add new complaint categories and specific sub-problems for the Guest QR form.
          </p>
        </div>

        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Pool & Beach Safety"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Short Code
              </label>
              <input
                type="text"
                placeholder="POOL-SAFE"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Icon
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 bg-slate-50">
                {AVAILABLE_CATEGORY_ICONS.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`p-1.5 rounded transition ${
                      icon === iconName
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CategoryIcon name={iconName} className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {['#dc2626', '#ea580c', '#0284c7', '#0d9488', '#7c3aed', '#16a34a'].map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 ${
                          color === c ? 'border-slate-900 scale-110' : 'border-white'
                        }`}
                      />
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Default Severity
                </label>
                <select
                  value={defaultSeverity}
                  onChange={(e) => setDefaultSeverity(e.target.value as SeverityLevel)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Default Responsible Manager
            </label>
            <select
              value={defaultManagerId}
              onChange={(e) => setDefaultManagerId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold"
            >
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} — {m.department}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isPestRelated}
                onChange={(e) => setIsPestRelated(e.target.checked)}
                className="w-4 h-4 accent-slate-900"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Pest / Environmental Category
                </div>
                <div className="text-[10px] text-slate-500">
                  Included in Pest Heatmap filter
                </div>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresVerification}
                onChange={(e) => setRequiresVerification(e.target.checked)}
                className="w-4 h-4 accent-slate-900"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  Requires Verification
                </div>
                <div className="text-[10px] text-slate-500">
                  Officer verifies before dispatch
                </div>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Specific Sub-Problems (One per line)
            </label>
            <textarea
              rows={3}
              value={subIssuesText}
              onChange={(e) => setSubIssuesText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{creating ? 'Adding...' : 'Add Problem Category'}</span>
          </button>
        </form>
      </div>

      {/* Right 7 Cols: Existing Categories */}
      <div className="lg:col-span-7 space-y-4">
        {categories.map((cat) => {
          const mgr = managers.find((m) => m.id === cat.default_manager_id);
          return (
            <div
              key={cat.id}
              className="bg-white rounded-xl p-5 border border-slate-200 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    <CategoryIcon name={cat.icon} className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                        {cat.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Default Manager:{' '}
                      <strong className="text-slate-800">
                        {mgr ? `${mgr.full_name} (${mgr.department})` : 'Super Manager'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleFlag(cat, 'is_pest_related')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      cat.is_pest_related
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>Pest Category</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleFlag(cat, 'requires_verification')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      cat.requires_verification
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Requires Verification</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-500">
                  Sub-Problems ({cat.sub_issues?.length || 0})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(cat.sub_issues || []).map((issue) => (
                    <span
                      key={issue}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      <span>{issue}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubIssue(cat, issue)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={`Add specific problem to ${cat.name}...`}
                    value={newSubIssueByCat[cat.id] || ''}
                    onChange={(e) =>
                      setNewSubIssueByCat({ ...newSubIssueByCat, [cat.id]: e.target.value })
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSubIssue(cat)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
