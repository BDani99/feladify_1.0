const sendError = (res, status, message, code = null, details = null) => {
  const body = { message };
  if (code) body.code = code;
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(status).json(body);
};

const sendUnauthorized = (res, message = 'Hozzáférés megtagadva. Bejelentkezés szükséges.', code = 'UNAUTHORIZED') =>
  sendError(res, 401, message, code);

const sendForbidden = (res, message = 'Hozzáférés megtagadva.', code = 'FORBIDDEN') =>
  sendError(res, 403, message, code);

const sendNotFound = (res, message = 'Az erőforrás nem található.', code = 'NOT_FOUND') =>
  sendError(res, 404, message, code);

const sendBadRequest = (res, message, code = 'BAD_REQUEST') =>
  sendError(res, 400, message, code);

const sendServerError = (res, message = 'Belső szerverhiba történt.', code = 'SERVER_ERROR') =>
  sendError(res, 500, message, code);

module.exports = { sendError, sendUnauthorized, sendForbidden, sendNotFound, sendBadRequest, sendServerError };
