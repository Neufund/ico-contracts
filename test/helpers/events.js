import { expect } from "chai";

export function hasEvent(tx, eventName) {
  expect(tx).to.have.property("logs");
  return tx.logs.find(e => e.event === eventName) !== undefined;
}

export function eventValue(tx, eventName, parName) {
  const events = tx.logs.filter(e => e.event === eventName);
  expect(events, `Event ${eventName} not found in logs`).to.not.be.empty;
  expect(events, `Multiple ${eventName} events found in logs`).to.have.lengthOf(
    1
  );
  const event = events[0];
  if (parName) {
    expect(
      event.args,
      `Parameter ${parName} not in ${eventName} event`
    ).to.have.property(parName);
    return event.args[parName];
  }
  return event;
}
