function sendSuccess(res, data = {}, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, statusCode = 500, message = 'Something went wrong', data = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(data && { data }),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendSuccess, sendError };
