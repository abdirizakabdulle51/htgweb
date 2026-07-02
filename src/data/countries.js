export const countries = [
  { value: "Somalia", code: "SO", phoneCode: "+252", phonePlaceholder: "+252 61 1234567" },
  { value: "Kenya", code: "KE", phoneCode: "+254" },
  { value: "Somaliland", code: "SO-SL", phoneCode: "+252" },
  { value: "Ethiopia", code: "ET", phoneCode: "+251" },
  { value: "Djibouti", code: "DJ", phoneCode: "+253" }
].map((country) => ({
  ...country,
  phonePlaceholder: country.phonePlaceholder || `${country.phoneCode} 123 456 789`
}));
