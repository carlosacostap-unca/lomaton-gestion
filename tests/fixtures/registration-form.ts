export const registrationHeaders = [
  "Marca temporal",
  "Apellido y nombres",
  "DNI",
  "N° de teléfono",
  "Dirección de correo electrónico",
  "¿Qué vínculo tiene con el nivel superior?",
  "¿De qué departamento de la Facultad de Tecnologia y Ciencias Aplicadas?",
  "¿Te interesa participar como mentor/a de uno de los equipos durante el LOMATON Catamarca?",
  "¿Que carrera de la Facultad de Tecnologia y Ciencias Aplicadas esta cursando?",
  "¿Ya tenés un equipo conformado para participar del LOMATON Catamarca?",
  "Si la respuesta anterior es positiva ¿Quiénes integran tu equipo?",
  "He leído y acepto las Bases y Condiciones de Participación del LOMATON Catamarca.",
  "Autorizo el uso de mi imagen y voz en los términos establecidos en las Bases, para la comunicación y difusión institucional del LOMATON Catamarca",
  "¿De qué unidad académica proviene?",
  "¿Qué carrera estudia?",
  "¿Ya tenés un equipo conformado para participar del LOMATON Catamarca?",
  "Si la respuesta anterior es positiva ¿Quiénes integran tu equipo?",
  "He leído y acepto las Bases y Condiciones de Participación del LOMATON Catamarca.",
  "Autorizo el uso de mi imagen y voz en los términos establecidos en las Bases, para la comunicación y difusión institucional del LOMATON Catamarca",
  "Docentes externos",
] as const;

export type RegistrationFixture = {
  submittedAt?: string;
  fullName?: string;
  dni?: string;
  phone?: string;
  email?: string;
  relationship?: string;
  department?: string;
  mentorInterest?: string;
  ftcaCareer?: string;
  ftcaTeamStatus?: string;
  ftcaTeamMembers?: string;
  ftcaTerms?: string;
  ftcaMedia?: string;
  academicUnit?: string;
  externalCareer?: string;
  externalTeamStatus?: string;
  externalTeamMembers?: string;
  externalTerms?: string;
  externalMedia?: string;
  externalTeacherDescription?: string;
};

export function registrationRow(overrides: RegistrationFixture = {}) {
  const row: Required<RegistrationFixture> = {
    submittedAt: "19/08/2026 10:00:00",
    fullName: "Persona de Prueba",
    dni: "30111222",
    phone: "3834000000",
    email: "persona@example.test",
    relationship: "Estudiante FTYCA",
    department: "",
    mentorInterest: "",
    ftcaCareer: "Ingeniería en Informática",
    ftcaTeamStatus: "No, todavía no tengo equipo.",
    ftcaTeamMembers: "",
    ftcaTerms: "Sí",
    ftcaMedia: "Autorizo",
    academicUnit: "",
    externalCareer: "",
    externalTeamStatus: "",
    externalTeamMembers: "",
    externalTerms: "",
    externalMedia: "",
    externalTeacherDescription: "",
    ...overrides,
  };
  return [
    row.submittedAt,
    row.fullName,
    row.dni,
    row.phone,
    row.email,
    row.relationship,
    row.department,
    row.mentorInterest,
    row.ftcaCareer,
    row.ftcaTeamStatus,
    row.ftcaTeamMembers,
    row.ftcaTerms,
    row.ftcaMedia,
    row.academicUnit,
    row.externalCareer,
    row.externalTeamStatus,
    row.externalTeamMembers,
    row.externalTerms,
    row.externalMedia,
    row.externalTeacherDescription,
  ];
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function registrationCsv(rows: string[][]) {
  return [registrationHeaders, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}
