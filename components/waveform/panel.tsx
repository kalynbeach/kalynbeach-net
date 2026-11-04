"use client";

/*
 * WaveformPanel: every setting of the provider's waveform, presets first as
 * chips, then one collapsible section per group of the settings table.
 * Only the source control is named here, for `input` below, so a new
 * control in ./settings.ts appears with no edit here. A control that can't change the picture now is
 * disabled and says why, or hidden when it belongs to the other display
 * mode. Each section's Reset, its first row, returns its controls to
 * DEFAULT_WAVEFORM_CONFIG, and stays disabled while they hold it. The Forms
 * section's Reset covers the shown form only. With `input`, the Source
 * section shows its WaveformInputPicker in place of the source control, so
 * the picker is the one source choice: Tones writes the config's source
 * "tones", and Input or File writes "audio". A reset that covers the
 * source, Reset source or WaveformResetAllButton, also stops the input, as
 * picking Tones does, so a visit's resume that answers later can't undo
 * it. Without it, the source control stays. The panel fits a 320 px column
 * with no sideways scroll, and its targets grow to 44 px under a coarse
 * pointer. Its first child is always Presets.
 *
 * WaveformResetAllButton and WaveformRandomizeButton sit outside the panel,
 * in the page's own toolbar, since a page may keep the panel in a sheet
 * away from it. Reset all returns every control to the default and stays
 * disabled at it. Randomize draws randomFigure() in ./settings.ts. Both
 * need the provider's onConfigChange.
 *
 *   const input = useWaveformInput(config, setConfig)
 *
 *   <WaveformProvider config={config} onConfigChange={setConfig} audio={input.feed}>
 *     <WaveformRandomizeButton />
 *     <WaveformResetAllButton input={input} />
 *     <WaveformPanel form={form} onFormChange={setForm} input={input} />
 *   </WaveformProvider>
 */

import * as React from "react";
import { ArrowCounterClockwiseIcon, ShuffleIcon } from "@phosphor-icons/react";
import { cn } from "cn";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
  randomFigure,
  resetControls,
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
import { WaveformInputPicker, type WaveformInput } from "./input";
import { useWaveformConfig } from "./waveform";

export type WaveformPanelProps = {
  /** The form whose settings the Forms section shows. Without it the panel keeps its own, starting at "stage". */
  readonly form?: Form;
  /** Called when the Forms section picks a form, so a page can show it. */
  readonly onFormChange?: (form: Form) => void;
  /** The host's useWaveformInput(), whose picker the Source section shows in place of the source control. */
  readonly input?: WaveformInput;
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

/** The controls a section shows and resets: its group's, and in Forms only the shown form's. */
const sectionIds = (group: ControlGroup, form: Form) =>
  (GROUP_IDS.get(group) ?? []).filter((id) => (formOf(id) ?? form) === form);

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

/** Applies `write` to the provider's latest config. The panel keeps one for its life, so a memoized field skips a render while its own value holds. */
type Edit = (write: (config: WaveformConfig) => WaveformConfig) => void;

/*
 * A field takes its control's value and reason, not the config, so React.memo
 * skips it while those hold. A drag then renders its own field and leaves
 * the panel's other fields alone.
 */
type FieldProps<C, V> = {
  readonly control: C;
  readonly value: V;
  /** Why it is disabled, or null when it applies. */
  readonly reason: string | null;
  readonly edit: Edit;
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

const NumberField = React.memo(function NumberField({
  control,
  value,
  reason,
  edit,
}: FieldProps<NumberControl, number>) {
  const log = control.scale === "log";

  return (
    <Field disabled={reason !== null}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel>{control.label}</FieldLabel>
        <output className="type-pixel font-label text-foreground tabular-nums">
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
          edit((config) =>
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
});

/** A choice field's value is its option's value as a string, as Select and ToggleGroup take it. */
const ChoiceField = React.memo(function ChoiceField({
  control,
  value,
  reason,
  edit,
}: FieldProps<ChoiceControl, string>) {
  const pick = (picked: string | null) => {
    const option = control.options.find(
      (item) => String(item.value) === picked
    );

    if (option) edit((config) => writeChoice(config, control, option.value));
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
        face="label"
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
});

const SwitchField = React.memo(function SwitchField({
  control,
  value,
  reason,
  edit,
}: FieldProps<SwitchControl, boolean>) {
  return (
    <Field disabled={reason !== null}>
      <div className="flex min-h-8 items-center justify-between gap-3 pointer-coarse:min-h-11">
        <FieldLabel>{control.label}</FieldLabel>
        <Switch
          aria-label={control.label}
          disabled={reason !== null}
          checked={value}
          onCheckedChange={(checked) =>
            edit((config) => writeSwitch(config, control, checked))
          }
        />
      </div>
      <Description effect={control.effect} reason={reason} />
    </Field>
  );
});

function ControlField({
  id,
  config,
  context,
  edit,
}: {
  id: ControlId;
  config: WaveformConfig;
  context: ControlContext;
  edit: Edit;
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
          value={control.read(config)}
          reason={reason}
          edit={edit}
        />
      );

    case "choice":
      return (
        <ChoiceField
          control={control}
          value={String(control.read(config))}
          reason={reason}
          edit={edit}
        />
      );

    case "switch":
      return (
        <SwitchField
          control={control}
          value={control.read(config)}
          reason={reason}
          edit={edit}
        />
      );
  }
}

export function WaveformPanel({
  form,
  onFormChange,
  input,
  className,
}: WaveformPanelProps) {
  const { config, onConfigChange } = useWaveformConfig();
  const hdrDisplay = useHdrDisplay();
  const context = React.useMemo(() => ({ hdrDisplay }), [hdrDisplay]);
  const [ownForm, setOwnForm] = React.useState<Form>("stage");
  const shownForm = form ?? ownForm;
  const active = activePreset(config, context);

  // The config of the last commit, which edits build on, as the render's
  // own config would. A field's handlers outlive the render that made them.
  const latest = React.useRef(config);

  React.useLayoutEffect(() => {
    latest.current = config;
  }, [config]);

  const edit = React.useCallback<Edit>(
    (write) => {
      const next = write(latest.current);

      if (next !== latest.current) onConfigChange?.(next);
    },
    [onConfigChange]
  );

  const reset = (ids: readonly ControlId[]) => {
    if (input && ids.includes("source")) input.stop();

    edit((current) => resetControls(current, ids));
  };

  return (
    <section
      aria-label="Waveform settings"
      className={cn("flex min-w-0 flex-col gap-4", className)}
    >
      <Field>
        <FieldLabel>Presets</FieldLabel>
        <ToggleGroup
          face="label"
          aria-label="Presets"
          variant="outline"
          size="sm"
          value={active ? [active] : []}
          onValueChange={(values) => {
            const id = PRESET_ORDER.find((item) => item === values[0]);

            if (id) edit((current) => applyPreset(current, id));
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
        {SECTIONS.map((section) => {
          const ids = sectionIds(section.group, shownForm);
          const sectionReset = resetControls(config, ids);
          const shown = input ? ids.filter((id) => id !== "source") : ids;

          const name =
            section.group === "forms"
              ? FORM_LABELS[shownForm].toLowerCase()
              : section.label.toLowerCase();

          return (
            <AccordionItem key={section.group} value={section.group}>
              <AccordionTrigger className="items-center pointer-coarse:min-h-11">
                <span className="type-heading-1 text-foreground">
                  {section.label}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <FieldGroup>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={sectionReset === config}
                    onClick={() => reset(ids)}
                    className="self-start pointer-coarse:h-11"
                  >
                    {`Reset ${name}`}
                  </Button>
                  {section.group === "source" && input ? (
                    <WaveformInputPicker input={input} />
                  ) : null}
                  {section.group === "forms" ? (
                    <Field>
                      <FieldLabel>Form</FieldLabel>
                      <ToggleGroup
                        face="label"
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
                  {shown.map((id) => (
                    <ControlField
                      key={id}
                      id={id}
                      config={config}
                      context={context}
                      edit={edit}
                    />
                  ))}
                </FieldGroup>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}

/**
 * Returns every control to DEFAULT_WAVEFORM_CONFIG through the provider's
 * onConfigChange, and stays disabled while they hold it. With `input`, it
 * also stops the input, as picking Tones does, since it resets the source.
 * Its label is a child with data-label, so a narrow toolbar can show the
 * icon alone and keep the label as the button's name, as with
 * max-sm:*:data-label:sr-only.
 */
export function WaveformResetAllButton({
  input,
  className,
}: {
  readonly input?: WaveformInput;
  readonly className?: string;
}) {
  const { config, onConfigChange } = useWaveformConfig();
  const reset = resetControls(config, CONTROL_IDS);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!onConfigChange || reset === config}
      onClick={() => {
        input?.stop();
        onConfigChange?.(reset);
      }}
      className={className}
    >
      <ArrowCounterClockwiseIcon data-icon="inline-start" aria-hidden="true" />
      <span data-label="">Reset all</span>
    </Button>
  );
}

/**
 * A new figure from randomFigure() in ./settings.ts through the provider's
 * onConfigChange, in one edit, as a preset is: the tones, the motion, and
 * the light's shape. Its label is a child with data-label, as
 * WaveformResetAllButton's is.
 */
export function WaveformRandomizeButton({
  className,
}: {
  readonly className?: string;
}) {
  const { config, onConfigChange } = useWaveformConfig();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!onConfigChange}
      onClick={() => onConfigChange?.(randomFigure(config))}
      className={className}
    >
      <ShuffleIcon data-icon="inline-start" aria-hidden="true" />
      <span data-label="">Randomize</span>
    </Button>
  );
}
