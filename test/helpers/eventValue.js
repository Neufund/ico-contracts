export default function eventValue(tx, eventName, parName) {
  const events = tx.logs.filter(e => e.event === eventName);
  // console.log(events);
  if (events.length >= 1) {
    // find last one
    return events[events.length-1].args[parName];
  }
}
