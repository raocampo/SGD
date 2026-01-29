const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ruta general para uploads
const uploadPath = path.join(__dirname, "..", "uploads");

// Crear carpeta uploads si no existe
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath);
}

// Configuración de almacenamiento de multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Si el campo uploadFolder está definido, usarlo; de lo contrario, "equipos"
    const folder = req.uploadFolder || "equipos";  // Aquí asignamos por defecto "equipos"
    const fullPath = path.join(uploadPath, folder);

    // Verificar si existe la carpeta, sino crearla
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    cb(null, fullPath); // Establecer destino de almacenamiento
  },

  filename: function (req, file, cb) {
    // Usamos un nombre único para evitar conflictos
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname); // Extensión del archivo
    cb(null, uniqueName + ext.toLowerCase()); // Establecer el nombre del archivo
  },
});

// Filtro de archivo para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  
  if (!allowed.includes(file.mimetype)) {
    req.fileValidationError = "Solo se permiten imágenes (JPG, PNG, WEBP)";
    return cb(null, false);  // Si no es una imagen válida, rechazamos el archivo
  }

  cb(null, true);  // Si es válida, aceptamos el archivo
};

// Configuración de los límites de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // Limite de 2MB para los archivos
  },
});

module.exports = upload;
