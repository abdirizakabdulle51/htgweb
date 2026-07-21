const allowedSpecialCharacters = "~!@#$%^&*()-_=+[{}]|;:'\",.<>/?";
const allowedSpecialPattern = new RegExp(`[${escapeRegExp(allowedSpecialCharacters)}]`);
const disallowedSpecialPattern = new RegExp(`[^A-Za-z0-9\\s${escapeRegExp(allowedSpecialCharacters)}]`);
const cjkOrFullWidthPattern = /[\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/;

export const passwordPolicyRules = [
  {
    id: "length",
    label: "8 to 32 characters"
  },
  {
    id: "letters",
    label: "At least 2 letters, including 1 uppercase and 1 lowercase"
  },
  {
    id: "digit",
    label: "At least 1 digit"
  },
  {
    id: "special",
    label: `At least 1 allowed special character: ${allowedSpecialCharacters}`
  },
  {
    id: "username",
    label: "Cannot contain the username"
  },
  {
    id: "reversedUsername",
    label: "Cannot contain the username spelled backwards"
  },
  {
    id: "repeatedCharacters",
    label: "No more than 2 identical characters in a row"
  },
  {
    id: "repeatingPattern",
    label: "Cannot be a repeated character pattern"
  },
  {
    id: "personalInfo",
    label: "Cannot contain your phone number, email, or email name"
  },
  {
    id: "characterSet",
    label: "No Chinese or full-width characters"
  }
];

export function validateManageOnePassword(password, context = {}) {
  const value = String(password || "");
  const username = normalizeText(context.username);
  const reversedUsername = reverse(username);
  const email = normalizeText(context.email);
  const emailLocalPart = normalizeText(email.split("@")[0]);
  const phoneDigits = onlyDigits(context.phone);
  const passwordLower = value.toLowerCase();
  const passwordDigits = onlyDigits(value);
  const letterMatches = value.match(/[A-Za-z]/g) || [];

  const checks = {
    length: value.length >= 8 && value.length <= 32,
    letters: letterMatches.length >= 2 && /[A-Z]/.test(value) && /[a-z]/.test(value),
    digit: /\d/.test(value),
    special: allowedSpecialPattern.test(value) && !disallowedSpecialPattern.test(value),
    username: !username || !passwordLower.includes(username),
    reversedUsername:
      !reversedUsername || reversedUsername.length < 2 || !passwordLower.includes(reversedUsername),
    repeatedCharacters: !/(.)\1\1/.test(value),
    repeatingPattern: !isRepeatingPattern(value),
    personalInfo:
      (!email || !passwordLower.includes(email)) &&
      (!emailLocalPart || !passwordLower.includes(emailLocalPart)) &&
      (!phoneDigits || !passwordDigits.includes(phoneDigits)),
    characterSet: !cjkOrFullWidthPattern.test(value)
  };

  const results = passwordPolicyRules.map((rule) => ({
    ...rule,
    valid: Boolean(checks[rule.id])
  }));

  return {
    valid: results.every((rule) => rule.valid),
    results,
    failed: results.filter((rule) => !rule.valid)
  };
}

export function passwordStrength(password, validation) {
  const value = String(password || "");
  const passed = validation?.results?.filter((rule) => rule.valid).length || 0;
  const variety =
    Number(/[a-z]/.test(value)) +
    Number(/[A-Z]/.test(value)) +
    Number(/\d/.test(value)) +
    Number(allowedSpecialPattern.test(value));

  if (!value || passed < 6) return "Weak";
  if (passed < passwordPolicyRules.length || value.length < 12 || variety < 4) return "Medium";
  return "Strong";
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function reverse(value) {
  return value.split("").reverse().join("");
}

function isRepeatingPattern(value) {
  if (value.length < 4) return false;

  for (let size = 1; size <= Math.floor(value.length / 2); size += 1) {
    if (value.length % size !== 0) continue;
    const pattern = value.slice(0, size);
    const repetitions = value.length / size;
    if (repetitions > 1 && pattern.repeat(repetitions) === value) return true;
  }

  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}
