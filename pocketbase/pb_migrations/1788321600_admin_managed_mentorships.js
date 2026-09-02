/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let mentorships;
  let invitations;
  try {
    mentorships = app.findCollectionByNameOrId("team_mentorships");
    invitations = app.findCollectionByNameOrId("mentor_invitations");
  } catch {
    return;
  }

  mentorships.removeIndex("idx_team_mentorships_mentor");
  mentorships.addIndex(
    "idx_team_mentorships_mentor_lookup",
    false,
    "mentor",
    "",
  );
  app.save(mentorships);

  const pending = app.findRecordsByFilter(
    invitations,
    "status = 'pending'",
    "created",
    10000,
    0,
  );
  const resolvedAt = new DateTime();
  for (const invitation of pending) {
    invitation.set("status", "cancelled");
    invitation.set("resolvedAt", resolvedAt);
    app.save(invitation);
  }
}, (app) => {
  let mentorships;
  try {
    mentorships = app.findCollectionByNameOrId("team_mentorships");
  } catch {
    return;
  }

  const assignments = app.findRecordsByFilter(
    mentorships,
    "",
    "created",
    10000,
    0,
  );
  const mentors = new Set();
  for (const assignment of assignments) {
    const mentor = assignment.getString("mentor");
    if (mentors.has(mentor)) {
      throw new Error(
        "No se puede restaurar la unicidad: un docente acompaña a varios equipos.",
      );
    }
    mentors.add(mentor);
  }

  mentorships.removeIndex("idx_team_mentorships_mentor_lookup");
  mentorships.addIndex(
    "idx_team_mentorships_mentor",
    true,
    "mentor",
    "",
  );
  app.save(mentorships);
});
