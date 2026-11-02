import { Trans } from '@lingui/react/macro';
import { fmt } from '../utils/format';
import { NumberCell, SectionTitle } from './statisticsUi.jsx';

export function ProfileGroupTable({ profileGroups, showTitle = true }) {
  if (!profileGroups || profileGroups.length === 0) return null;

  return (
    <div>
      {showTitle && (
        <SectionTitle className='mb-2'>
          <Trans>Per-profile statistics</Trans>
        </SectionTitle>
      )}
      <div className='overflow-x-auto'>
        <table className='table-xs table w-full'>
          <thead>
            <tr className='text-xs opacity-60'>
              <th>
                <Trans>Profile</Trans>
              </th>
              <th className='text-right'>
                <Trans>Shots</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Duration</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Weight</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pumped Water</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pressure</Trans>
              </th>
              <th className='text-right'>
                <Trans>Avg Pump Flow</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {profileGroups.map(group => (
              <tr key={group.profileName}>
                <td className='font-semibold'>{group.profileName}</td>
                <NumberCell>{group.shotCount}</NumberCell>
                <NumberCell>{fmt(group.avgDuration)}s</NumberCell>
                <NumberCell>{fmt(group.avgWeight)}g</NumberCell>
                <NumberCell>{fmt(group.avgWater)}ml</NumberCell>
                <NumberCell>{fmt(group.metrics.p?.avg)} bar</NumberCell>
                <NumberCell>{fmt(group.metrics.f?.avg)} ml/s</NumberCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
