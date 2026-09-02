export const UNREGISTERED_ACCOUNT_MESSAGE =
  "Según los registros de la plataforma, tu cuenta no está registrada. Para solicitar asistencia, comunicate con los organizadores del evento.";

export const UNVERIFIED_EMAIL_MESSAGE =
  "Google no pudo verificar el email de la cuenta seleccionada. Probá con otra cuenta o comunicate con los organizadores del evento.";

export const GENERIC_LOGIN_ERROR_MESSAGE =
  "No pudimos iniciar sesión. Verificá que elegiste el mismo email que figura en el padrón o contactá a la organización.";

export function getPublicBootstrapErrorMessage(code: unknown): string | null {
  if (code === "email_not_authorized") return UNREGISTERED_ACCOUNT_MESSAGE;
  if (code === "email_not_verified") return UNVERIFIED_EMAIL_MESSAGE;
  return null;
}
