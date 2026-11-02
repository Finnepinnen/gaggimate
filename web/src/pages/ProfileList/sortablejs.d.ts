// Minimal typings for the parts of sortablejs the profile list uses (no @types/sortablejs installed).
declare module 'sortablejs' {
  export interface SortableEvent extends Event {
    oldIndex?: number;
    newIndex?: number;
    /** MultiDrag: indices of all dragged items. */
    oldIndicies: { index: number; multiDragElement: HTMLElement }[];
  }

  export interface Options {
    animation?: number;
    handle?: string;
    disabled?: boolean;
    /** MultiDrag plugin */
    multiDrag?: boolean;
    selectedClass?: string;
    onStart?: (evt: SortableEvent) => void;
    onChange?: (evt: SortableEvent) => void;
    onEnd?: (evt: SortableEvent) => void;
  }

  export class MultiDrag {}

  export default class Sortable {
    static create(el: HTMLElement, options?: Options): Sortable;
    static mount(...plugins: unknown[]): void;
    destroy(): void;
  }
}
