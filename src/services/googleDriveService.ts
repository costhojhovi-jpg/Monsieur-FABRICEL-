import { auth, signInWithPopup, User } from "@/lib/firebase";
import { GoogleAuthProvider } from "firebase/auth";

// Scopes required for Google Drive & Picker integration
export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

/**
 * Creates a dedicated GoogleAuthProvider instance specifically for Google Drive operations.
 * CRITICAL: This is kept separate from the base app login provider to prevent Google from
 * blocking unverified users on the main sign-in screen.
 */
export function createDriveAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({ prompt: 'consent' });
  return provider;
}

// In-memory token cache.
// The token is deliberately NOT persisted in localStorage/sessionStorage.
const DRIVE_TOKEN_MAX_AGE_MS = 55 * 60 * 1000; // 55 minutes

let cachedAccessToken: string | null = null;
let cachedAccessTokenUid: string | null = null;
let cachedAccessTokenExpiresAt: number | null = null;
let isSigningIn = false;

export const setCachedAccessToken = (token: string | null) => {
  if (!token) {
    cachedAccessToken = null;
    cachedAccessTokenUid = null;
    cachedAccessTokenExpiresAt = null;
    return;
  }

  cachedAccessToken = token;
  cachedAccessTokenUid = auth.currentUser?.uid ?? null;
  cachedAccessTokenExpiresAt = Date.now() + DRIVE_TOKEN_MAX_AGE_MS;
};

export const getCachedAccessToken = (): string | null => {
  if (!cachedAccessToken) {
    return null;
  }

  if (
    cachedAccessTokenExpiresAt === null ||
    Date.now() >= cachedAccessTokenExpiresAt
  ) {
    setCachedAccessToken(null);
    return null;
  }

  const currentUid = auth.currentUser?.uid ?? null;

  if (!currentUid || cachedAccessTokenUid !== currentUid) {
    setCachedAccessToken(null);
    return null;
  }

  return cachedAccessToken;
};

/**
 * Obtain an OAuth access token for Google Drive operations.
 * If not present in memory, prompts the user via Google Sign-In popup with drive.file scope.
 */
export async function getDriveAccessToken(): Promise<{ user: User; accessToken: string }> {
  const validCachedAccessToken = getCachedAccessToken();

  if (validCachedAccessToken && auth.currentUser) {
    return {
      user: auth.currentUser,
      accessToken: validCachedAccessToken
    };
  }

  if (isSigningIn) {
    // If a sign-in popup is already being handled, wait briefly
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 200));
      if (cachedAccessToken && auth.currentUser) {
        return { user: auth.currentUser, accessToken: cachedAccessToken };
      }
    }
    const busyError: any = new Error("Une tentative d'autorisation Google Drive est déjà en cours. Veuillez valider la fenêtre ou patienter.");
    busyError.code = "auth/already-in-progress";
    busyError.isCancelled = true;
    throw busyError;
  }

  isSigningIn = true;
  try {
    const driveProvider = createDriveAuthProvider();
    const result = await signInWithPopup(auth, driveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Impossible de récupérer le jeton d'accès Google Drive. Veuillez réessayer.");
    }
    setCachedAccessToken(credential.accessToken);

    return {
      user: result.user,
      accessToken: credential.accessToken
    };
  } catch (error: any) {
    const isCancelled =
      error?.code === "auth/popup-closed-by-user" ||
      error?.code === "auth/cancelled-popup-request" ||
      error?.code === "auth/popup-blocked" ||
      (error?.message && error.message.includes("popup-closed-by-user")) ||
      (error?.message && error.message.includes("cancelled-popup-request")) ||
      (error?.message && error.message.includes("popup-blocked"));

    if (isCancelled) {
      console.info("Autorisation Google Drive : fenêtre fermée ou bloquée par le navigateur.");
      const cancelError: any = new Error("La fenêtre d'autorisation Google Drive a été fermée. Vous pouvez réessayer ou télécharger directement votre fiche en PDF ou Word.");
      cancelError.code = error?.code || "auth/popup-closed-by-user";
      cancelError.isCancelled = true;
      throw cancelError;
    }

    const isAppBlocked =
      error?.code === "auth/access-denied" ||
      error?.code === "auth/unauthorized-domain" ||
      error?.code === "auth/operation-not-allowed" ||
      (error?.message && (
        error.message.includes("blocked") ||
        error.message.includes("access_denied") ||
        error.message.includes("disallowed_useragent")
      ));

    if (isAppBlocked) {
      console.warn("Accès Google Drive restreint par Google:", error?.message || error);
      const blockedError: any = new Error("L'accès à Google Drive est restreint par Google tant que la certification de l'application est en cours de validation. Vous pouvez télécharger directement votre fiche sur votre appareil (PDF ou Word).");
      blockedError.code = error?.code || "auth/access-denied";
      blockedError.isBlocked = true;
      throw blockedError;
    }

    console.warn("Avertissement d'autorisation Google Drive:", error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
}

/**
 * Dynamically loads the Google API client script and initializes the Google Picker API.
 */
let pickerLoadPromise: Promise<void> | null = null;

export function loadPickerApi(): Promise<void> {
  if (pickerLoadPromise) return pickerLoadPromise;

  pickerLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const checkGapi = () => {
      const gapi = (window as any).gapi;
      if (gapi) {
        gapi.load("picker", {
          callback: () => resolve(),
          onerror: () => reject(new Error("Échec du chargement de Google Picker API.")),
          timeout: 10000,
          ontimeout: () => reject(new Error("Délai d'attente dépassé pour Google Picker API."))
        });
      } else {
        // Inject script if not loaded
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          const g = (window as any).gapi;
          if (g) {
            g.load("picker", {
              callback: () => resolve(),
              onerror: () => reject(new Error("Échec du chargement de Google Picker API."))
            });
          } else {
            reject(new Error("Objet gapi introuvable après chargement du script."));
          }
        };
        script.onerror = () => reject(new Error("Impossible de charger le script Google API."));
        document.head.appendChild(script);
      }
    };

    checkGapi();
  });

  return pickerLoadPromise;
}

export interface DriveFolder {
  id: string;
  name: string;
}

/**
 * Opens Google Picker modal allowing the teacher to select a destination folder in their Google Drive.
 */
export async function openGoogleDrivePicker(
  accessToken: string,
  onFolderSelected: (folder: DriveFolder) => void,
  onCancel?: () => void
): Promise<void> {
  await loadPickerApi();

  const google = (window as any).google;
  if (!google || !google.picker) {
    throw new Error("L'API Google Picker n'est pas encore prête.");
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  // View for Folders
  const docsView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setSelectFolderEnabled(true)
    .setIncludeFolders(true)
    .setMimeTypes("application/vnd.google-apps.folder");

  const picker = new google.picker.PickerBuilder()
    .addView(docsView)
    .setOAuthToken(accessToken)
    .setOrigin(pickerOrigin)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs?.[0];
        if (doc) {
          onFolderSelected({ id: doc.id, name: doc.name });
        }
      } else if (data.action === google.picker.Action.CANCEL) {
        if (onCancel) onCancel();
      }
    })
    .setTitle("Choisir le dossier de destination pour la fiche")
    .build();

  picker.setVisible(true);
}

/**
 * Searches for or creates a dedicated default folder "Monsieur FABRICEL - Fiches Pédagogiques (MEN)" in Google Drive.
 */
export async function getOrCreateFabricelFolder(accessToken: string): Promise<DriveFolder> {
  const folderName = "Monsieur FABRICEL - Fiches Pédagogiques (MEN)";

  try {
    // 1. Search existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`
    )}&fields=files(id,name)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.files && data.files.length > 0) {
        return { id: data.files[0].id, name: data.files[0].name };
      }
    }

    // 2. Create folder if not found
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        description: "Fiches pédagogiques, situations-problèmes et exercices générés par Monsieur FABRICEL."
      })
    });

    if (!createRes.ok) {
      throw new Error(`Erreur lors de la création du dossier (${createRes.status})`);
    }

    const newFolder = await createRes.json();
    return { id: newFolder.id, name: folderName };
  } catch (error) {
    console.warn("Could not find or create dedicated folder, saving to root drive:", error);
    return { id: "root", name: "Mon Drive (Racine)" };
  }
}

export interface UploadOptions {
  title: string;
  subject?: string;
  grade?: string;
  docType?: string;
  format: "gdoc" | "pdf" | "docx" | "md";
  content: string | Blob;
  folderId?: string;
}

export interface UploadResult {
  fileId: string;
  name: string;
  webViewLink?: string;
  folderName?: string;
}

/**
 * Uploads a pedagogical file to Google Drive using multipart upload.
 */
export async function uploadToGoogleDrive(
  accessToken: string,
  options: UploadOptions
): Promise<UploadResult> {
  const cleanTitle = (options.title || "Fiche_Pedagogique").replace(/[/\\?%*:|"<>]/g, "-").trim();
  const timestamp = new Date().toISOString().slice(0, 10);
  
  let targetMimeType = "text/plain";
  let uploadMimeType = "text/plain";
  let extension = ".txt";

  if (options.format === "gdoc") {
    // Converts directly to a native editable Google Doc!
    targetMimeType = "application/vnd.google-apps.document";
    uploadMimeType = "text/html";
    extension = "";
  } else if (options.format === "pdf") {
    targetMimeType = "application/pdf";
    uploadMimeType = "application/pdf";
    extension = ".pdf";
  } else if (options.format === "docx") {
    targetMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    uploadMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    extension = ".docx";
  } else if (options.format === "md") {
    targetMimeType = "text/markdown";
    uploadMimeType = "text/markdown";
    extension = ".md";
  }

  const fileName = `${cleanTitle}_${options.grade || ""}_${timestamp}${extension}`.replace(/\s+/g, "_");

  // Determine parent folder
  let parentFolderId = options.folderId;
  let targetFolderName = "Google Drive";

  if (!parentFolderId || parentFolderId === "auto") {
    const defaultFolder = await getOrCreateFabricelFolder(accessToken);
    parentFolderId = defaultFolder.id === "root" ? undefined : defaultFolder.id;
    targetFolderName = defaultFolder.name;
  }

  const metadata: any = {
    name: fileName,
    mimeType: targetMimeType,
    description: `Fiche pédagogique générée par Monsieur FABRICEL - ${options.docType || "Document pédagogique"} (${options.subject || ""}, ${options.grade || ""}).`
  };

  if (parentFolderId && parentFolderId !== "root") {
    metadata.parents = [parentFolderId];
  }

  // Prepare body content
  let bodyBlob: Blob;
  if (typeof options.content === "string") {
    if (options.format === "gdoc") {
      // Wrap Markdown or text in HTML container for smooth conversion into Google Doc
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${cleanTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 40px; }
    h1 { color: #059669; font-size: 18pt; border-bottom: 2px solid #059669; padding-bottom: 6px; }
    h2 { color: #047857; font-size: 14pt; margin-top: 18pt; }
    h3 { color: #065f46; font-size: 12pt; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background-color: #f1f5f9; }
    blockquote { border-left: 4px solid #059669; padding-left: 12px; color: #475569; }
  </style>
</head>
<body>
  <div>
    <p><strong>Ministère de l'Éducation Nationale (Madagascar) - Nouveau Programme d'Études</strong></p>
    <p><em>Discipline : ${options.subject || "Mathématiques"} | Niveau : ${options.grade || "Collège/Lycée"}</em></p>
    <hr/>
  </div>
  <pre style="white-space: pre-wrap; font-family: inherit;">${options.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
      bodyBlob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    } else {
      bodyBlob = new Blob([options.content], { type: `${uploadMimeType};charset=utf-8` });
    }
  } else {
    bodyBlob = options.content;
  }

  // Construct multipart/related request
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaPartHeader = `${delimiter}Content-Type: ${uploadMimeType}\r\n\r\n`;

  // Combine into single Blob
  const multipartBlob = new Blob(
    [metadataPart, mediaPartHeader, bodyBlob, closeDelimiter],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: multipartBlob
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    console.error("Drive upload error response:", errText);
    throw new Error(`Erreur lors de l'envoi vers Google Drive (${uploadRes.status}): ${errText.substring(0, 150)}`);
  }

  const uploadedFile = await uploadRes.json();

  return {
    fileId: uploadedFile.id,
    name: uploadedFile.name || fileName,
    webViewLink: uploadedFile.webViewLink || `https://drive.google.com/file/d/${uploadedFile.id}/view`,
    folderName: targetFolderName
  };
}

