"use client";

/*
 * WaveformPanel: every setting of the provider's waveform, presets first as
 * chips, then one collapsible section per group of the settings table.
 * Nothing here lists a control by name, so a new control in ./settings.ts
 * appears with no edit here. A control that can't change the picture now is
 * disabled and says why, or hidden when it belongs to the other display
 * mode. The panel fits a 320 px column with no sideways scroll, and its
 * targets grow to 44 px under a coarse pointer.
 *
 *   <WaveformProvider config={config} onConfigChange={setConfig}>
 *     <WaveformPanel form={form} onFormChange={setForm} />
 *   </WaveformProvider>
 */

import * as React from "react";
import { cn } from "cn";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  CONTROLS,
  CONTROL_IDS,
  FORMS,
  PRESETS,
  PRESET_ORDER,
  activePreset,
  applyPreset,
  formOf,
  unmetNeed,
  writeChoice,
  writeNumber,
  writeSwitch,
  type ChoiceControl,
  type ControlContext,
  type ControlGroup,
  type ControlId,
  type Form,
  type NumberControl,
  type SwitchControl,
  type WaveformConfig,
} from "./settings";
import { useWaveformConfig } from "./waveform";

export type WaveformPanelProps = {
  /** The form whose settings the Forms section shows. Without it the panel keeps its own, starting at "stage". */
  readonly form?: Form;
  /** Called when the Forms section picks a form, so a page can show it. */
  readonly onFormChange?: (form: Form) => void;
  /** Layout classes only. */
  readonly className?: string;
};

const SECTIONS: readonly {
  readonly group: ControlGroup;
  readonly label: string;
}[] = [
  { group: "figure", label: "Figure" },
  { group: "motion", label: "Motion" },
  { group: "display", label: "Display" },
  { group: "light", label: "Light" },
  { group: "forms", label: "Forms" },
  { group: "source", label: "Source" },
];

const FORM_LABELS = {
  stage: "Stage",
  glow: "Glow",
  screen: "Screen",
  mark: "Mark",
} as const satisfies { readonly [F in Form]: string };

/** Each group's control ids, in table order. */
const GROUP_IDS = new Map<ControlGroup, ControlId[]>(
  SECTIONS.map(({ group }) => [group, []])
);

for (const id of CONTROL_IDS) GROUP_IDS.get(CONTROLS[id].group)?.push(id);

/** A log control's slider spreads its range over this many positions by ratio. */
const TAPER_STEPS = 1000;

function toPosition(control: NumberControl, value: number) {
  if (control.scale !== "log") return value;

  return (
    (Math.log(value / control.min) / Math.log(control.max / control.min)) *
    TAPER_STEPS
  );
}

function fromPosition(control: NumberControl, position: number) {
  if (control.scale !== "log") return position;

  return control.min * (control.max / control.min) ** (position / TAPER_STEPS);
}

/** Kevelle's Slider reports one thumb as a number or a one-item list. */
function firstValue(value: number | readonly number[]) {
  const [first = 0] = Array.isArray(value) ? value : [value];

  return first;
}

const hdrQuery = () => matchMedia("(dynamic-range: high)").matches;

function useHdrDisplay(): boolean {
  const subscribe = React.useCallback((listener: () => void) => {
    const list = matchMedia("(dynamic-range: high)");

    list.addEventListener("change", listener);

    return () => list.removeEventListener("change", listener);
  }, []);

  return React.useSyncExternalStore(subscribe, hdrQuery, () => false);
}

type FieldProps<C> = {
  readonly control: C;
  readonly config: WaveformConfig;
  /** Why it is disabled, or null when it applies. */
  readonly reason: string | null;
  readonly onConfig: (config: WaveformConfig) => void;
};

function Description({
  effect,
  reason,
}: {
  effect: string;
  reason: string | null;
}) {
  if (reason) return <FieldDescription>{reason}</FieldDescription>;

  // A vertical Field widens a direct sr-only child to its text, which
  // overflows a narrow column, so the effect sits one level down.
  return (
    <div className="contents">
      <FieldDescription className="sr-only">{effect}</FieldDescription>
    </div>
  );
}

function NumberField({
  control,
  config,
  reason,
  onConfig,
}: FieldProps<NumberControl>) {
  const value = control.read(config);
  const log = control.scale === "log";

  return (
    <Field disabled={reason !== null}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel>{control.label}</FieldLabel>
        <output className="type-pixel text-foreground tabular-nums">
          {control.format(value)}
        </output>
      </div>
      <Slider
        aria-label={control.label}
        disabled={reason !== null}
        min={log ? 0 : control.min}
        max={log ? TAPER_STEPS : control.max}
        step={log ? 1 : control.step}
        value={toPosition(control, value)}
        // A log slider's position is not its value, so announce the value.
        getAriaValueText={(_, position) =>
          control.format(fromPosition(control, position))
        }
        onValueChange={(next) =>
          onConfig(
            writeNumber(
              config,
              control,
              fromPosition(control, firstValue(next))
            )
          )
        }
      />
      <Description effect={control.effect} reason={reason} />
    </Field>
  );
}

function ChoiceField({
  control,
  config,
  reason,
  onConfig,
}: FieldProps<ChoiceControl>) {
  const value = String(control.read(config));

  const pick = (picked: string | null) => {
    const option = control.options.find(
      (item) => String(item.value) === picked
    );

    if (option) onConfig(writeChoice(config, control, option.value));
  };

  if (!control.chips && control.options.length > 4)
    return (
      <Field disabled={reason !== null}>
        <FieldLabel>{control.label}</FieldLabel>
        <Select
          items={control.options.map((option) => ({
            value: String(option.value),
            label: option.label,
          }))}
          value={value}
          disabled={reason !== null}
          onValueChange={pick}
        >
          <SelectTrigger
            aria-label={control.label}
            className="w-full pointer-coarse:h-11"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {control.options.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Description effect={control.effect} reason={reason} />
      </Field>
    );

  return (
    <Field disabled={reason !== null}>
      <FieldLabel>{control.label}</FieldLabel>
      <ToggleGroup
        aria-label={control.label}
        variant="outline"
        size="sm"
        // Chips take ToggleGroup's default spacing, and a short row joins its items.
        spacing={control.chips ? undefined : 0}
        disabled={reason !== null}
        value={[value]}
        // Pressing the active item again reports no value; keep the choice.
        onValueChange={(values) => pick(values[0] ?? null)}
        className="w-full flex-wrap"
      >
        {control.options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={String(option.value)}
            className={cn(
              "pointer-coarse:h-11",
              control.chips ? "pointer-coarse:min-w-11" : "flex-1"
            )}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Description effect={control.effect} reason={reason} />
    </Field>
  );
}

function SwitchField({
  control,
  config,
  reason,
  onConfig,
}: FieldProps<SwitchControl>) {
  return (
    <Field disabled={reason !== null}>
      <div className="flex min-h-8 items-center justify-between gap-3 pointer-coarse:min-h-11">
        <FieldLabel>{control.label}</FieldLabel>
        <Switch
          aria-label={control.label}
          disabled={reason !== null}
          checked={control.read(config)}
          onCheckedChange={(checked) =>
            onConfig(writeSwitch(config, control, checked))
          }
        />
      </div>
      <Description effect={control.effect} reason={reason} />
    </Field>
  );
}

function ControlField({
  id,
  config,
  context,
  onConfig,
}: {
  id: ControlId;
  config: WaveformConfig;
  context: ControlContext;
  onConfig: (config: WaveformConfig) => void;
}) {
  const control = CONTROLS[id];
  const need = unmetNeed(control, config, context);
  const reason = need?.reason ?? null;

  if (need && reason === null) return null;

  switch (control.kind) {
    case "number":
      return (
        <NumberField
          control={control}
          config={config}
          reason={reason}
          onConfig={onConfig}
        />
      );

    case "choice":
      return (
        <ChoiceField
          control={control}
          config={config}
          reason={reason}
          onConfig={onConfig}
        />
      );

    case "switch":
      return (
        <SwitchField
          control={control}
          config={config}
          reason={reason}
          onConfig={onConfig}
        />
      );
  }
}

export function WaveformPanel({
  form,
  onFormChange,
  className,
}: WaveformPanelProps) {
  const { config, onConfigChange } = useWaveformConfig();
  const hdrDisplay = useHdrDisplay();
  const context = React.useMemo(() => ({ hdrDisplay }), [hdrDisplay]);
  const [ownForm, setOwnForm] = React.useState<Form>("stage");
  const shownForm = form ?? ownForm;
  const active = activePreset(config, context);

  const onConfig = (next: WaveformConfig) => {
    if (next !== config) onConfigChange?.(next);
  };

  return (
    <section
      aria-label="Waveform settings"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <Field>
        <FieldLabel>Presets</FieldLabel>
        <ToggleGroup
          aria-label="Presets"
          variant="outline"
          size="sm"
          value={active ? [active] : []}
          onValueChange={(values) => {
            const id = PRESET_ORDER.find((item) => item === values[0]);

            if (id) onConfig(applyPreset(config, id));
          }}
          className="w-full flex-wrap"
        >
          {PRESET_ORDER.map((id) => (
            <ToggleGroupItem
              key={id}
              value={id}
              className="pointer-coarse:h-11"
            >
              {PRESETS[id].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Accordion multiple defaultValue={["figure"]}>
        {SECTIONS.map((section) => (
          <AccordionItem key={section.group} value={section.group}>
            <AccordionTrigger className="items-center pointer-coarse:min-h-11">
              {/* A group's name, so the machine's voice, like a sidebar group label. */}
              <span className="type-label text-muted-foreground">
                {section.label}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <FieldGroup>
                {section.group === "forms" ? (
                  <Field>
                    <FieldLabel>Form</FieldLabel>
                    <ToggleGroup
                      aria-label="Form"
                      variant="outline"
                      size="sm"
                      spacing={0}
                      value={[shownForm]}
                      onValueChange={(values) => {
                        const next = FORMS.find((item) => item === values[0]);

                        if (!next) return;
                        setOwnForm(next);
                        onFormChange?.(next);
                      }}
                      className="w-full"
                    >
                      {FORMS.map((item) => (
                        <ToggleGroupItem
                          key={item}
                          value={item}
                          className="flex-1 pointer-coarse:h-11"
                        >
                          {FORM_LABELS[item]}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                ) : null}
                {GROUP_IDS.get(section.group)?.map((id) =>
                  (formOf(id) ?? shownForm) === shownForm ? (
                    <ControlField
                      key={id}
                      id={id}
                      config={config}
                      context={context}
                      onConfig={onConfig}
                    />
                  ) : null
                )}
              </FieldGroup>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
