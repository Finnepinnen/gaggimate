import { describe, expect, test } from 'vitest';
import {
  AnalyzerControl,
  analyzerControlClasses,
} from '../src/pages/ShotAnalyzer/components/AnalyzerControl.jsx';

const textColour = /(^|\s)(hover:)?text-(base-content|primary|success|error)\S*/;

describe('analyzerControlClasses', () => {
  test('tones add a text colour', () => {
    expect(analyzerControlClasses({ variant: 'text' })).toMatch(textColour);
    expect(analyzerControlClasses({ variant: 'surface', tone: 'subtle' })).toMatch(textColour);
  });

  test("tone 'none' leaves the colour to the control's own classes", () => {
    // Controls with their own colours used to get the tone's too, and CSS order picked one.
    for (const variant of /** @type {const} */ (['icon', 'text', 'surface'])) {
      const classes = analyzerControlClasses({ variant, tone: 'none', className: 'text-primary' });
      expect(classes.match(new RegExp(textColour, 'g'))?.map(c => c.trim())).toEqual([
        'text-primary',
      ]);
    }
  });
});

describe('AnalyzerControl', () => {
  /** @param {Record<string, unknown>} props */
  const render = props => /** @type {import('preact').VNode<any>} */ (AnalyzerControl(props));

  test('renders a plain button, not a form submit', () => {
    expect(render({}).props.type).toBe('button');
    expect(render({ type: 'submit' }).props.type).toBe('submit');
  });

  test('gives other elements no type', () => {
    expect(render({ as: 'summary' }).props.type).toBeUndefined();
  });
});
