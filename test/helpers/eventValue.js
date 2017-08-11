export default function eventValue(tx, eventName, parName) {
  const event = logs.find(e => e.event === eventName);
  if (parName && event) {
    return event.args[parName];
  }
  return event;
}
