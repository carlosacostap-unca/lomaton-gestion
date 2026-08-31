function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

function evaluateGoogleAccess(input) {
  const provider = String(input.provider || "").trim().toLowerCase()
  const email = normalizeEmail(input.email)

  if (provider !== "google") {
    return { allowed: false, reason: "provider_not_allowed", email }
  }

  if (!email) {
    return { allowed: false, reason: "verified_email_required", email }
  }

  const candidate = input.candidate || null
  const admin = input.admin || null

  if (!candidate && !admin) {
    return { allowed: false, reason: "email_not_authorized", email }
  }

  return {
    allowed: true,
    reason: "allowed",
    email,
    candidateId: candidate ? candidate.id : "",
    isAdmin: Boolean(admin),
  }
}

module.exports = { evaluateGoogleAccess, normalizeEmail }
