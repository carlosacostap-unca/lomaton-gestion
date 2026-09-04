/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const cycles = app.findCollectionByNameOrId("evaluation_cycles")
  cycles.fields.add(new JSONField({ name: "criteriaSnapshot" }))
  app.save(cycles)

  const evaluations = app.findCollectionByNameOrId("jury_evaluations")
  evaluations.fields.add(
    new JSONField({ name: "aspectScores" }),
    new JSONField({ name: "aspectObservations" }),
    new NumberField({ name: "totalNumerator", onlyInt: true, min: 0 }),
    new NumberField({ name: "totalDenominator", onlyInt: true, min: 0 }),
  )
  app.save(evaluations)

  const results = app.findCollectionByNameOrId("evaluation_results")
  results.fields.add(
    new JSONField({ name: "criterionAspectScoreSums" }),
    new NumberField({ name: "totalNumeratorSum", onlyInt: true, min: 0 }),
    new NumberField({ name: "totalDenominator", onlyInt: true, min: 0 }),
  )
  for (const name of ["innovationSum", "impactSum", "viabilitySum", "presentationSum", "teamworkSum", "totalCentipointsSum"]) {
    results.fields.getByName(name).required = false
  }
  app.save(results)
}, (app) => {
  const results = app.findCollectionByNameOrId("evaluation_results")
  results.fields.removeByName("criterionAspectScoreSums")
  results.fields.removeByName("totalNumeratorSum")
  results.fields.removeByName("totalDenominator")
  for (const name of ["innovationSum", "impactSum", "viabilitySum", "presentationSum", "teamworkSum", "totalCentipointsSum"]) {
    results.fields.getByName(name).required = true
  }
  app.save(results)

  const evaluations = app.findCollectionByNameOrId("jury_evaluations")
  evaluations.fields.removeByName("aspectScores")
  evaluations.fields.removeByName("aspectObservations")
  evaluations.fields.removeByName("totalNumerator")
  evaluations.fields.removeByName("totalDenominator")
  app.save(evaluations)

  const cycles = app.findCollectionByNameOrId("evaluation_cycles")
  cycles.fields.removeByName("criteriaSnapshot")
  app.save(cycles)
})
