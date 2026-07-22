import { getCountries, getCountryCallingCode } from "libphonenumber-js";

const priorityCountries = ["SO", "KE", "ET", "DJ"];
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countries = getCountries()
  .filter((code) => code !== "AC" && code !== "TA")
  .map((code) => {
    const phoneCode = `+${getCountryCallingCode(code)}`;

    return {
      value: countryNames.of(code) || code,
      code,
      phoneCode,
      phonePlaceholder: code === "SO" ? "+252 61 1234567" : `${phoneCode} 123 456 789`
    };
  })
  .sort((left, right) => {
    const leftPriority = priorityCountries.indexOf(left.code);
    const rightPriority = priorityCountries.indexOf(right.code);

    if (leftPriority !== -1 || rightPriority !== -1) {
      return (leftPriority === -1 ? 999 : leftPriority) - (rightPriority === -1 ? 999 : rightPriority);
    }

    return left.value.localeCompare(right.value);
  });
