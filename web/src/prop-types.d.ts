// Minimal typings for the parts of prop-types the app uses (no @types/prop-types installed).
declare module 'prop-types' {
  type ValidatorFn = (
    props: Record<string, unknown>,
    propName: string,
    componentName: string,
  ) => Error | null;

  export interface Requireable extends ValidatorFn {
    isRequired: ValidatorFn;
  }

  export const any: Requireable;
  export const array: Requireable;
  export const bool: Requireable;
  export const func: Requireable;
  export const number: Requireable;
  export const object: Requireable;
  export const string: Requireable;
  export const node: Requireable;
  export const element: Requireable;
  export function arrayOf(type: ValidatorFn): Requireable;
  export function objectOf(type: ValidatorFn): Requireable;
  export function oneOf(values: readonly unknown[]): Requireable;
  export function oneOfType(types: readonly ValidatorFn[]): Requireable;
  export function shape(shape: Record<string, ValidatorFn>): Requireable;
  export function exact(shape: Record<string, ValidatorFn>): Requireable;
  export function instanceOf(ctor: abstract new (...args: never[]) => unknown): Requireable;

  const PropTypes: {
    any: Requireable;
    array: Requireable;
    bool: Requireable;
    func: Requireable;
    number: Requireable;
    object: Requireable;
    string: Requireable;
    node: Requireable;
    element: Requireable;
    arrayOf: typeof arrayOf;
    objectOf: typeof objectOf;
    oneOf: typeof oneOf;
    oneOfType: typeof oneOfType;
    shape: typeof shape;
    exact: typeof exact;
    instanceOf: typeof instanceOf;
  };
  export default PropTypes;
}
