// utils/asyncHandler.js
// Express 4 does not automatically catch rejected promises thrown inside
// async route handlers/middleware — an unhandled rejection there would hang
// the request instead of returning an error. Wrapping handlers with this
// forwards any thrown/rejected error to Express's error-handling middleware
// in server.js.
module.exports = function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
