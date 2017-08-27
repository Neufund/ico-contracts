import { hasEvent, eventValue } from "./events";

export default function error(tx) {
  // Default to zero on no error
  if (!hasEvent(tx, "Error")) {
    return 0;
  }
  return parseInt(eventValue(tx, "Error", "code"));
}
