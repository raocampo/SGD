// Subida de anuncios de transmisión: imágenes y videos cortos (reels).
// Mismo almacenamiento que el resto de archivos (UPLOADS_DIR), carpeta propia.
const multer = require("multer");
const path = require("path");
const { ensureUploadsRoot, getUploadsSubdir } = require("./uploads");

ensureUploadsRoot();

const TIPOS_IMAGEN = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
// MP4 (H.264) y WEBM se reproducen en Chrome y en el navegador de OBS.
const TIPOS_VIDEO = ["video/mp4", "video/webm"];
const MAX_MB = 60;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, getUploadsSubdir("anuncios"));
  },
  filename(req, file, cb) {
    const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unico + path.extname(file.originalname).toLowerCase());
  },
});

function fileFilter(req, file, cb) {
  if (TIPOS_IMAGEN.includes(file.mimetype) || TIPOS_VIDEO.includes(file.mimetype)) return cb(null, true);
  req.fileValidationError = "Formato no admitido: usa imagen (JPG, PNG, WEBP, GIF) o video MP4/WEBM";
  return cb(null, false);
}

const uploadMedia = multer({ storage, fileFilter, limits: { fileSize: MAX_MB * 1024 * 1024 } });

function tipoDeArchivo(file) {
  if (!file) return null;
  if (TIPOS_VIDEO.includes(file.mimetype)) return "video";
  if (TIPOS_IMAGEN.includes(file.mimetype)) return "imagen";
  return null;
}

// Middleware: un archivo «archivo» con errores en español (tamaño, formato).
function subirArchivoAnuncio(req, res, next) {
  uploadMedia.single("archivo")(req, res, (err) => {
    if (err) {
      const mensaje = err.code === "LIMIT_FILE_SIZE"
        ? `El archivo supera ${MAX_MB} MB. Comprime el video o acórtalo.`
        : err.message || "No se pudo subir el archivo";
      return res.status(400).json({ error: mensaje });
    }
    if (req.fileValidationError) return res.status(400).json({ error: req.fileValidationError });
    return next();
  });
}

module.exports = { subirArchivoAnuncio, tipoDeArchivo, MAX_MB };
