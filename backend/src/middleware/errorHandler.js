const errorHandler = (err, req, res, _next) => {
  console.error(err);
  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.issues || [],
    });
  }
  const status = err.status || 500;
  return res.status(status).json({
    message: err.message || "Internal Server Error",
  });
};

module.exports = { errorHandler };
