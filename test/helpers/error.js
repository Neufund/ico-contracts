import eventValue from "./eventValue";
export default function error(tx) {
  return parseInt(eventValue(tx, "Error", "code")) || 0;
}
