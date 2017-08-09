export default function eventValue(tx, eventName, parName) {
  const events = tx.logs.filter(e => e.event === eventName);
  if (events.length === 1) {
    return events[0].args[parName];
  }
}
