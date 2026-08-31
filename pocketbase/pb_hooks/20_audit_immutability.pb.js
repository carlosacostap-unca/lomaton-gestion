/// <reference path="../pb_data/types.d.ts" />

onRecordUpdate((e) => {
  throw new BadRequestError("Los registros de auditoría son inmutables.")
}, "audit_logs")

onRecordDelete((e) => {
  throw new BadRequestError("Los registros de auditoría son inmutables.")
}, "audit_logs")
