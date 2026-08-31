/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  throw new ForbiddenError("Los usuarios solamente pueden crearse mediante Google OAuth2.")
}, "users")

onRecordAuthWithOAuth2Request((e) => {
  const policy = require(`${__hooks}/lib/auth-policy.cjs`)
  const provider = String(e.providerName || "").toLowerCase()
  const oauthEmail = e.oauth2User ? e.oauth2User.email : ""
  const normalizedEmail = policy.normalizeEmail(oauthEmail)

  let candidate = null
  let admin = null

  if (normalizedEmail) {
    try {
      candidate = e.app.findFirstRecordByFilter(
        "candidates",
        "emailNormalized = {:email} && active = true",
        { email: normalizedEmail },
      )
    } catch {
      candidate = null
    }

    try {
      admin = e.app.findFirstRecordByFilter(
        "admin_allowlist",
        "emailNormalized = {:email} && active = true",
        { email: normalizedEmail },
      )
    } catch {
      admin = null
    }
  }

  const decision = policy.evaluateGoogleAccess({
    provider,
    email: normalizedEmail,
    candidate,
    admin,
  })

  if (!decision.allowed) {
    throw new ForbiddenError("La cuenta Google no está autorizada para este hackatón.", {
      reason: decision.reason,
    })
  }

  let user = e.record || null
  if (!user) {
    try {
      user = e.app.findAuthRecordByEmail("users", decision.email)
    } catch {
      user = null
    }
  }

  if (user && policy.normalizeEmail(user.email()) !== decision.email) {
    throw new ForbiddenError("La identidad Google no coincide con el email del usuario.")
  }

  const displayName = String(
    (e.oauth2User && e.oauth2User.name) ||
      (candidate ? `${candidate.getString("firstName")} ${candidate.getString("lastName")}` : ""),
  ).trim()

  if (user) {
    user.set("candidate", decision.candidateId)
    user.set("displayName", displayName)
    user.set("isAdmin", decision.isAdmin)
    user.set("enabled", true)
    user.setVerified(true)
    e.app.save(user)
    e.record = user
  } else {
    e.createData.email = decision.email
    e.createData.emailVisibility = false
    e.createData.verified = true
    e.createData.candidate = decision.candidateId
    e.createData.displayName = displayName
    e.createData.isAdmin = decision.isAdmin
    e.createData.enabled = true
  }

  e.next()
}, "users")
