// Types shared by the Shot Analyzer components (library, action bar, notes).
// Domain types (shots, profiles, analysis results) live in ../types.d.ts.

import type {
  AnalyzerProfile,
  AnalyzerProfilePhase,
  AnalyzerShot,
  LibrarySource,
  PendingShotSelection,
} from '../types';

/** Extra fields a library row may carry from either list (index entries, uploads, device profiles). */
export interface LibraryItemExtras {
  label?: string;
  title?: string;
  profile?: string;
  profileName?: string;
  /** Legacy alias of `source`. */
  src?: string;
  canonicalProfileName?: string;
  /** Unix epoch seconds */
  timestamp?: number;
  shotDate?: number;
  /** ms */
  duration?: number;
  rating?: number | null;
  volume?: number | null;
  samples?: AnalyzerShot['samples'];
  phases?: AnalyzerProfilePhase[];
}

export type LibraryShotItem = AnalyzerShot & LibraryItemExtras;
export type LibraryProfileItem = AnalyzerProfile & LibraryItemExtras;
/** A row of the shots or profiles list; `isShot` tells which. */
export type LibraryItem = LibraryShotItem | LibraryProfileItem;

/** Library list source filter as stored in the UI ('all' maps to the service's 'both'). */
export type LibraryUiSourceFilter = 'all' | 'gaggimate' | 'browser';

export type LibrarySortOrder = 'asc' | 'desc';

export interface LibrarySortConfig {
  /** 'shotDate' | 'name' | 'data.rating' | 'duration' or another item field. */
  key: string;
  order: LibrarySortOrder;
}

/** Pinned shot identity keys by profile pin key. */
export type PinnedShotsByProfile = Record<string, string[]>;

export type LibrarySelectionTarget =
  'primaryShot' | 'secondaryShot' | 'primaryProfile' | 'secondaryProfile';

export type LibraryMobileSection = 'shots' | 'profiles';

/** 'temp' opens imports in memory only; 'browser' also saves them to IndexedDB. */
export type ImportMode = 'temp' | 'browser';

export type ImportTargetType = 'any' | 'shot' | 'profile';
export type ImportSlot = 'primary' | 'secondary';

export interface ImportOptions {
  targetType?: ImportTargetType;
  slot?: ImportSlot;
}

export type LibraryImportHandler = (
  files: File[] | FileList,
  options?: ImportOptions,
) => Promise<void>;

/** A shot selection request emitted by the library / action bar (normalized by ShotAnalyzer). */
export interface LibraryShotSelectRequest {
  item: LibraryItem;
  name?: string;
  preserveCompare?: boolean;
  requestSelectionScroll?: boolean;
  debounceMs?: number;
  direction?: number;
  listSnapshot?: LibraryItem[];
  targetIndex?: number;
}

export type OnShotSelect = (request: LibraryShotSelectRequest) => void;
export type OnCompareShotToggle = (
  request: LibraryShotSelectRequest | LibraryItem,
  checked: boolean,
) => void | Promise<void>;
export type OnProfileLoad = (data: AnalyzerProfile, name: string, source?: LibrarySource) => void;

export type { PendingShotSelection };

/** Context handed to Statistics when opened from the analyzer. */
export interface AnalyzerStatsContext {
  shotSource: string;
  profileSource: string;
  profileName: string;
  source?: string;
  preferredDetailSection?: string;
}

export type OnShowStats = (context: AnalyzerStatsContext) => void;

export type ShotRowActionIntent =
  | { type: 'ignore' }
  | { type: 'selectSecondary' }
  | { type: 'swap' }
  | { type: 'selectPrimary'; closeLibrary: boolean; requestSelectionScroll: boolean };

/** Bar placement rect measured from the library's sticky anchor. */
export interface LibraryBarRect {
  width: number;
  left: number;
  height: number;
}

export interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

export type MobileSubpage = 'analysis' | 'notes';
