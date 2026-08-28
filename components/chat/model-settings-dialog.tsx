"use client";

import { useCallback, useMemo, useState } from "react";
import { saveModelSettings } from "@/app/(chat)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupCatalogue,
  type ModelGroup,
  useModelCatalogue,
} from "@/hooks/use-model-catalogue";
import {
  INHERIT,
  MODEL_ROLE_INFO,
  MODEL_ROLES,
  type ModelRole,
  type ModelSettings,
} from "@/lib/ai/roles";
import { toast } from "./toast";

// The chat model is chosen in the composer, so it is context here, not a field.
const EDITABLE_ROLES = MODEL_ROLES.filter((role) => role !== "chat");

function RoleField({
  groups,
  onChange,
  role,
  value,
}: {
  groups: ModelGroup[];
  onChange: (role: ModelRole, value: string) => void;
  role: ModelRole;
  value: string;
}) {
  // Bound here rather than inline in the list, so the select does not get a new
  // handler identity on every render of the dialog.
  const handleValueChange = useCallback(
    (next: string) => onChange(role, next),
    [onChange, role]
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-medium text-[13px]">{MODEL_ROLE_INFO[role].label}</p>
        <p className="text-[12px] text-muted-foreground">
          {MODEL_ROLE_INFO[role].description}
        </p>
      </div>
      <Select onValueChange={handleValueChange} value={value}>
        <SelectTrigger
          className="w-[200px] shrink-0 text-[13px]"
          data-testid={`model-settings-${role}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>Follow chat model</SelectItem>
          {groups.map((group) => (
            <SelectGroup key={group.key}>
              <SelectLabel>{group.heading}</SelectLabel>
              {group.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ModelSettingsDialog({
  onOpenChange,
  open,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { catalogue, mutate, providers, settings } = useModelCatalogue();
  const [draft, setDraft] = useState<ModelSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const current = draft ?? settings;
  const groups = useMemo(
    () =>
      groupCatalogue(catalogue, providers)
        .filter((group) => group.selectable)
        .map((group) => ({
          ...group,
          models: group.models.filter((model) => model.callable),
        }))
        .filter((group) => group.models.length > 0),
    [catalogue, providers]
  );

  const handleChange = useCallback((role: ModelRole, value: string) => {
    setDraft((previous) => {
      const next = { ...(previous ?? {}) };

      if (value === INHERIT) {
        delete next[role];
      } else {
        next[role] = value;
      }

      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      await saveModelSettings(draft ?? {});
      await mutate();
      setDraft(null);
      onOpenChange(false);
      toast({ description: "Model settings saved.", type: "success" });
    } catch {
      toast({ description: "Could not save model settings.", type: "error" });
    } finally {
      setIsSaving(false);
    }
  }, [draft, mutate, onOpenChange]);

  const handleReset = useCallback(() => {
    setDraft({});
  }, []);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-[560px]"
        data-testid="model-settings-dialog"
      >
        <DialogHeader>
          <DialogTitle>Model settings</DialogTitle>
          <DialogDescription>
            Pick which model runs each job. Anything left on “Follow chat model”
            uses whatever the conversation is set to.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {EDITABLE_ROLES.map((role) => (
            <RoleField
              groups={groups}
              key={role}
              onChange={handleChange}
              role={role}
              value={current[role] ?? INHERIT}
            />
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleReset} type="button" variant="ghost">
            Reset to defaults
          </Button>
          <Button
            data-testid="model-settings-save"
            disabled={isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
