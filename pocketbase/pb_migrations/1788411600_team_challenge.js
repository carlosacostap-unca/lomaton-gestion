/// <reference path="../pb_data/types.d.ts" />

const challengeValues = [
  "problematicas-imagenes",
  "transito-planta",
  "sistemas-medicion",
  "consumo-materiales",
  "edificios-sustentables",
]

migrate((app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.add(new SelectField({
    name: "challenge",
    maxSelect: 1,
    values: challengeValues,
  }))
  app.save(teams)
}, (app) => {
  const teams = app.findCollectionByNameOrId("teams")
  teams.fields.removeByName("challenge")
  app.save(teams)
})
