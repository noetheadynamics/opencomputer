import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Plus, Trash2, Power, PowerOff, Play, X, ChevronDown, ChevronUp } from 'lucide-react';
import { subagentApi } from '../../lib/subagents';
import type { SubagentConfig, SubagentCreateRequest } from '../../types/subagent';
import { TASK_TYPES, AVAILABLE_TOOLS } from '../../types/subagent';

export const SubagentManagerPanel: React.FC = () => {
  const [subagents, setSubagents] = useState<SubagentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState<SubagentCreateRequest>({
    name: '',
    task_type: 'custom',
    system_prompt: '',
    model: '',
    tools: [],
    enabled: true,
  });

  const loadData = useCallback(async () => {
    try {
      const data = await subagentApi.list();
      setSubagents(data.subagents);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await subagentApi.create(form);
      setCreating(false);
      setForm({ name: '', task_type: 'custom', system_prompt: '', model: '', tools: [], enabled: true });
      await loadData();
    } catch {}
  };

  const handleUpdate = async (id: string) => {
    try {
      await subagentApi.update(id, form);
      setEditing(null);
      await loadData();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await subagentApi.delete(id);
      await loadData();
    } catch {}
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await subagentApi.toggle(id, enabled);
      await loadData();
    } catch {}
  };

  const handleTest = async (id: string) => {
    if (!testQuery.trim()) return;
    try {
      const result = await subagentApi.test(id, testQuery);
      setTestResult(result.success ? result.response || 'OK' : result.error || 'Failed');
    } catch (e: any) {
      setTestResult(e.message);
    }
  };

  const startEdit = (sa: SubagentConfig) => {
    setEditing(sa.id);
    setCreating(false);
    setForm({
      name: sa.name,
      task_type: sa.task_type,
      system_prompt: sa.system_prompt,
      model: sa.model,
      tools: sa.tools,
      enabled: sa.enabled,
    });
  };

  const toggleTool = (tool: string) => {
    setForm((prev) => ({
      ...prev,
      tools: (prev.tools || []).includes(tool) ? (prev.tools || []).filter((t) => t !== tool) : [...(prev.tools || []), tool],
    }));
  };

  return (
    <div className="flex h-full flex-col p-4">
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-oc-accent" />
          <h2 className="text-lg font-semibold text-zinc-100">Custom Subagents</h2>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); setForm({ name: '', task_type: 'custom', system_prompt: '', model: '', tools: [], enabled: true }); }}
          className="oc-glass-btn-primary px-3 py-1.5 text-sm flex items-center gap-1"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="oc-glass-panel p-4 space-y-3 overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-200">New Subagent</span>
              <button onClick={() => setCreating(false)} className="text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
            </div>
            <SubagentForm form={form} setForm={setForm} toggleTool={toggleTool} />
            <div className="flex gap-2">
              <button onClick={handleCreate} className="oc-glass-btn-primary px-3 py-1 text-sm">Create</button>
              <button onClick={() => setCreating(false)} className="oc-glass-btn px-3 py-1 text-sm">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subagent list */}
      <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="text-center text-zinc-500 text-sm py-8">Loading...</div>
      ) : subagents.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-8">No custom subagents. Click "+ New" to create one.</div>
      ) : (
        <div className="space-y-3">
          {subagents.map((sa) => (
            <div key={sa.id} className="oc-glass-panel p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-zinc-200">{sa.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sa.enabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {sa.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-xs text-zinc-500">{sa.task_type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggle(sa.id, !sa.enabled)} className="oc-glass-btn p-1.5" title="Toggle">
                    {sa.enabled ? <Power size={14} /> : <PowerOff size={14} />}
                  </button>
                  <button onClick={() => expanded === sa.id ? setExpanded(null) : setExpanded(sa.id)} className="oc-glass-btn p-1.5">
                    {expanded === sa.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-500">
                Model: {sa.model || 'default'} · Tools: {sa.tools.length}
              </div>

              {/* Expanded section */}
              <AnimatePresence>
                {expanded === sa.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 overflow-hidden">
                    {sa.system_prompt && (
                      <div className="text-xs text-zinc-400 bg-oc-bg/50 rounded p-2 max-h-20 overflow-y-auto">
                        {sa.system_prompt}
                      </div>
                    )}

                    {/* Edit form */}
                    {editing === sa.id ? (
                      <div className="space-y-3">
                        <SubagentForm form={form} setForm={setForm} toggleTool={toggleTool} />
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdate(sa.id)} className="oc-glass-btn-primary px-3 py-1 text-sm">Save</button>
                          <button onClick={() => setEditing(null)} className="oc-glass-btn px-3 py-1 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(sa)} className="oc-glass-btn px-3 py-1 text-sm">Edit</button>
                          <button onClick={() => handleDelete(sa.id)} className="oc-glass-btn px-3 py-1 text-sm text-red-400 hover:text-red-300">
                            <Trash2 size={12} className="inline mr-1" />Delete
                          </button>
                        </div>

                        {/* Test */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={testQuery}
                            onChange={(e) => setTestQuery(e.target.value)}
                            placeholder="Test query..."
                            className="oc-glass-input flex-1 text-xs"
                          />
                          <button onClick={() => handleTest(sa.id)} className="oc-glass-btn px-3 py-1 text-sm flex items-center gap-1">
                            <Play size={12} />Test
                          </button>
                        </div>
                        {testResult && (
                          <div className="text-xs text-zinc-400 bg-oc-bg/50 rounded p-2">{testResult}</div>
                        )}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const SubagentForm: React.FC<{
  form: SubagentCreateRequest;
  setForm: React.Dispatch<React.SetStateAction<SubagentCreateRequest>>;
  toggleTool: (tool: string) => void;
}> = ({ form, setForm, toggleTool }) => (
  <div className="space-y-3">
    <input
      type="text"
      value={form.name}
      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
      placeholder="Subagent name"
      className="oc-glass-input w-full text-sm"
    />
    <select
      value={form.task_type}
      onChange={(e) => setForm((p) => ({ ...p, task_type: e.target.value }))}
      className="oc-glass-input w-full text-sm"
    >
      {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
    <input
      type="text"
      value={form.model}
      onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
      placeholder="Model (optional)"
      className="oc-glass-input w-full text-sm"
    />
    <textarea
      value={form.system_prompt}
      onChange={(e) => setForm((p) => ({ ...p, system_prompt: e.target.value }))}
      placeholder="System prompt..."
      rows={3}
      className="oc-glass-input w-full text-sm resize-none"
    />
    <div>
      <div className="text-xs text-zinc-500 mb-1">Tools</div>
      <div className="flex flex-wrap gap-1">
        {AVAILABLE_TOOLS.map((tool) => (
          <button
            key={tool}
            onClick={() => toggleTool(tool)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              (form.tools || []).includes(tool)
                ? 'bg-oc-accent/20 border-oc-accent/50 text-oc-accent'
                : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
            }`}
          >
            {tool}
          </button>
        ))}
      </div>
    </div>
  </div>
);
