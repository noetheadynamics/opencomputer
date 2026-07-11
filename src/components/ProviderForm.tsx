import * as React from "react";
import { motion } from "framer-motion";
import { Trash2, TestTube2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { testConnection, type TestResult } from "@/lib/api";
import type { Provider } from "@/lib/providers";

interface ProviderFormProps {
  initial?: Provider;
  onSave: (provider: Provider) => void;
  onDelete?: (id: string) => void;
}

export function ProviderForm({ initial, onSave, onDelete }: ProviderFormProps) {
  const [form, setForm] = React.useState<Omit<Provider, "id">>({
    label: initial?.label ?? "",
    baseUrl: initial?.baseUrl ?? "",
    apiKey: initial?.apiKey ?? "",
    model: initial?.model ?? "",
  });
  const [test, setTest] = React.useState<TestResult | null>(null);
  const [testing, setTesting] = React.useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setTest(null);
  }

  async function runTest() {
    if (!form.baseUrl || !form.model) return;
    setTesting(true);
    setTest(null);
    const result = await testConnection({
      id: initial?.id ?? "preview",
      ...form,
    });
    setTest(result);
    setTesting(false);
  }

  function submit() {
    if (!form.label.trim() || !form.baseUrl.trim() || !form.model.trim()) return;
    onSave({ id: initial?.id ?? `p_${Date.now().toString(36)}`, ...form });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="p-label">Display label</Label>
        <Input
          id="p-label"
          placeholder="Alethea Local"
          value={form.label}
          onChange={(e) => update("label", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-url">Base URL</Label>
        <Input
          id="p-url"
          placeholder="http://localhost:8000/v1"
          value={form.baseUrl}
          onChange={(e) => update("baseUrl", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-key">API key</Label>
        <Input
          id="p-key"
          type="password"
          placeholder="sk-…"
          value={form.apiKey}
          onChange={(e) => update("apiKey", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-model">Model name</Label>
        <Input
          id="p-model"
          placeholder="alethea-v2"
          value={form.model}
          onChange={(e) => update("model", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={runTest}
          disabled={testing || !form.baseUrl || !form.model}
        >
          {testing ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <TestTube2 size={15} />
          )}
          Test Connection
        </Button>
        {test && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1 text-xs ${
              test.ok ? "text-oc-accent" : "text-red-400"
            }`}
          >
            {test.ok ? (
              <CheckCircle2 size={14} />
            ) : (
              <XCircle size={14} />
            )}
            {test.message}
          </motion.span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        {initial && onDelete ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => onDelete(initial.id)}
          >
            <Trash2 size={15} /> Delete
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" onClick={submit}>
          {initial ? "Save changes" : "Add provider"}
        </Button>
      </div>
    </div>
  );
}
