import eventValue from './eventValue'
export default function error(tx) {
  return parseInt(eventValue(tx, 'ReturnCode', 'rc')) || 0;
}
