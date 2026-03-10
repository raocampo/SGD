const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const defaultUploadsDir = path.resolve(__dirname, "..", "uploads");
const configuredUploadsDir = String(process.env.UPLOADS_DIR || "").trim();
const uploadsDir = path.resolve(configuredUploadsDir || defaultUploadsDir);

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

function ensureUploadsRoot() {
  return ensureDirectory(uploadsDir);
}

function getUploadsSubdir(folder = "") {
  const normalizedFolder = String(folder || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const relativeFolder = normalizedFolder
    ? path.posix.normalize(normalizedFolder)
    : "";

  if (relativeFolder.startsWith("..")) {
    throw new Error("Ruta de uploads inválida");
  }

  return ensureDirectory(
    relativeFolder ? path.join(uploadsDir, relativeFolder) : uploadsDir
  );
}

function toUploadsRelativePath(input = "") {
  const normalized = String(input || "")
    .replace(/\\/g, "/")
    .trim();
  if (!normalized) return "";

  const withoutPrefix = normalized
    .replace(/^\/+/, "")
    .replace(/^uploads\/+/i, "");
  const relativePath = path.posix.normalize(withoutPrefix);

  if (
    !relativePath ||
    relativePath === "." ||
    relativePath.startsWith("..")
  ) {
    return "";
  }

  return relativePath;
}

function resolveUploadPath(input = "") {
  const relativePath = toUploadsRelativePath(input);
  return relativePath ? path.join(uploadsDir, relativePath) : uploadsDir;
}

module.exports = {
  defaultUploadsDir,
  uploadsDir,
  ensureDirectory,
  ensureUploadsRoot,
  getUploadsSubdir,
  resolveUploadPath,
  toUploadsRelativePath,
};
