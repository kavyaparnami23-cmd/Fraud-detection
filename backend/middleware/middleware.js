const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const id = decoded.id ?? decoded.sub ?? decoded.userId;
    if (!id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.user = { ...decoded, id };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};
