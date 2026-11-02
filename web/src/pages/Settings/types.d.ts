// Local types for the Settings page and its tabs.

/**
 * Settings form state: GET /api/settings fields plus form-only fields (kf, button0..2,
 * standbyDisplayEnabled, dashboardLayout). Values are raw form strings, numbers or booleans
 * depending on where they came from, so fields stay loosely typed.
 */
export type SettingsFormData = Record<string, any>;

/** An event-like value whose current target carries a form value. */
export interface FieldChangeEvent {
  currentTarget: { value: string };
}

/** Handler for one form field change. */
export type FieldChangeHandler = (e: FieldChangeEvent) => void;

/** Builds the change handler for a settings key. */
export type FormChange = (key: string) => FieldChangeHandler;

/** Sets one form field directly. */
export type SetField = (key: string, value: unknown) => void;

/** One automatic wakeup entry; `days` is Monday..Sunday. */
export interface AutoWakeupSchedule {
  time: string;
  days: boolean[];
}

/** Auto wakeup schedule editing callbacks passed down from the Settings page. */
export interface AutoWakeupProps {
  autowakeupSchedules: AutoWakeupSchedule[];
  addAutoWakeupSchedule: () => void;
  removeAutoWakeupSchedule: (index: number) => void;
  updateAutoWakeupTime: (index: number, value: string) => void;
  updateAutoWakeupDay: (scheduleIndex: number, dayIndex: number, enabled: boolean) => void;
}

/** Called after a setting was saved directly to the machine (Smart Dosing autosave). */
export type SettingSavedHandler = (key: string, value: any, settings: SettingsFormData) => void;

/** Smart Dosing autosave callbacks passed down from the Settings page. */
export interface SmartDoseSaveProps {
  onSmartDoseSaved?: SettingSavedHandler;
  onSmartDoseSaving?: (saving: boolean) => void;
  settingsDisabled?: boolean;
}
