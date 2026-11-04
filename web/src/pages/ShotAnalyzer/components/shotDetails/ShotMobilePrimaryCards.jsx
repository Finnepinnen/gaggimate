import { ShotMainInfoCard } from './ShotMainInfoCard';
import { useShotNotesState } from '../useShotNotesState';

/** @param {{ entry: import('../../types').AnalysisCompareEntry }} props */
export function ShotMobilePrimaryCards({ entry }) {
  const { loading, notes, updateAndSave } = useShotNotesState({
    currentShot: entry?.shot,
  });

  return (
    <div className='shot-mobile-primary-cards flex flex-col lg:hidden'>
      <ShotMainInfoCard
        entry={entry}
        notes={notes}
        loading={loading}
        onRatingChange={value => updateAndSave('rating', value)}
      />
    </div>
  );
}
