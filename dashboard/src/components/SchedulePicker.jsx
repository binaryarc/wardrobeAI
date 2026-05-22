import ScheduleDropdown from './ScheduleDropdown.jsx';

export default function SchedulePicker({ schedule, onChange }) {
  return <ScheduleDropdown value={schedule} onChange={onChange} />;
}
