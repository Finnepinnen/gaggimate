// Types for the profile editor. Form inputs write raw strings back into numeric fields until saved.
import type { JSX } from 'preact';
import type { PhaseTransition, Profile, ProfilePhase, ProfileType } from '../../types';

/** Change event whose `target` is the element the handler is bound to. */
export type FieldEvent<T extends EventTarget = HTMLInputElement> = JSX.TargetedEvent<T, Event> & {
  target: T;
};

export interface EditorTransition extends PhaseTransition {
  /** Ramp axis; only set by the editor. */
  target?: 'time' | 'volumetric' | 'pumped';
}

export interface EditorPhase extends Omit<ProfilePhase, 'duration' | 'transition'> {
  /** String while being edited. */
  duration: number | string;
  transition?: EditorTransition;
}

export interface EditorProfile extends Omit<Profile, 'phases' | 'type'> {
  /** Unset until chosen on a new profile. */
  type?: ProfileType;
  phases: EditorPhase[];
}

export interface ProfileFormProps {
  data: EditorProfile;
  onChange: (data: EditorProfile) => void;
  onSave: (data: EditorProfile) => void | Promise<void>;
  saving?: boolean;
  pressureAvailable?: boolean;
}
