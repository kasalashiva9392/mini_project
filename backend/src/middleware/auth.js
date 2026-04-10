const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const auth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      const err = new Error("User not found");
      err.status = 401;
      throw err;
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    const err = new Error("Forbidden");
    err.status = 403;
    return next(err);
  }
  return next();
};

module.exports = { auth, authorize };
