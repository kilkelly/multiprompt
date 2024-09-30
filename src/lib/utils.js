// converts an environmental variable to a boolean value
export function envToBool (value) {
  if (typeof value === "string") {
    value = value.toLowerCase()
    return ["true", "1"].indexOf(value) >= 0
  }
  return value
}