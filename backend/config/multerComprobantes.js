const multer = require("multer");
const path = require("path");
const { getUploadsSubdir } = require("./uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadsSubdir("comprobantes"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, unique + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.mimetype)) {
    req.fileValidationError = "Solo se permiten imágenes (JPG, PNG, WEBP) o PDF";
    return cb(null, false);
  }
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
