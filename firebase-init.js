/**
 * KARTTA — Conexión real con Firebase (Auth + Firestore)
 * ============================================================
 * Este archivo es el paso 1: hacer que el botón "Crear mi KARTTA"
 * de la landing cree una cuenta DE VERDAD, no la simulación.
 *
 * Qué hace:
 *  1. Inicializa Firebase con tu proyecto (rellena FIREBASE_CONFIG abajo).
 *  2. Expone window.KARTTA_AUTH con las 5 funciones que la landing
 *     ya espera (signup, login, google, logout, onChange) — no hay
 *     que tocar el HTML/JS de la landing para nada más.
 *  3. En el registro, crea automáticamente:
 *       usuarios/{uid}                         -> perfil básico
 *       negocios/{negocioId}                   -> datos del negocio
 *       negocios/{negocioId}/miembros/{uid}    -> { rol: "owner" }
 *     que es exactamente lo que esperan firestore.rules e index.js
 *     (las Cloud Functions) que ya te dejé.
 *
 * CÓMO USARLO
 * ------------------------------------------------------------
 * 1) Ve a https://console.firebase.google.com -> tu proyecto
 *    -> ícono de engranaje -> "Configuración del proyecto"
 *    -> baja hasta "Tus apps" -> si no tienes una app web, créala
 *    -> copia el objeto firebaseConfig que te muestra.
 * 2) Pega esos valores en FIREBASE_CONFIG más abajo.
 * 3) En Firebase Console activa (si no lo has hecho):
 *      Authentication -> Sign-in method -> Correo/contraseña (ON)
 *      Authentication -> Sign-in method -> Google (ON)
 * 4) En tu kartta-landing.html, justo antes de </head>, agrega:
 *      <script type="module" src="firebase-init.js"></script>
 *    (sube este archivo a la misma carpeta que el HTML, o pon la
 *    ruta/URL donde lo hospedes).
 * 5. Abre la web: el modal de "Crear mi KARTTA" ya crea usuarios
 *    reales en tu Firebase. Revísalo en Authentication -> Users
 *    y en Firestore Database -> negocios.
 * ============================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ------------------------------------------------------------
// 1) TU CONFIGURACIÓN DE FIREBASE — reemplaza estos valores
// ------------------------------------------------------------
const FIREBASE_CONFIG = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "TU-PROYECTO.firebaseapp.com",
  projectId: "TU-PROYECTO",
  storageBucket: "TU-PROYECTO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------
// 2) Helpers para crear el negocio + membresía owner al registrarse
// ------------------------------------------------------------

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "mi-negocio";
}

async function crearNegocioParaNuevoUsuario(user, nombreNegocio) {
  const negocioId = `${slugify(nombreNegocio)}-${user.uid.slice(0, 6)}`;

  await setDoc(doc(db, "usuarios", user.uid), {
    nombre: user.displayName || nombreNegocio,
    email: user.email,
    negocioId,
    creado: serverTimestamp(),
  });

  await setDoc(doc(db, "negocios", negocioId), {
    nombre: nombreNegocio || "Mi negocio",
    ownerUid: user.uid,
    plan: "trial", // el 1 mes gratis del que habla la landing
    creado: serverTimestamp(),
  });

  await setDoc(doc(db, "negocios", negocioId, "miembros", user.uid), {
    rol: "owner",
    email: user.email,
    desde: serverTimestamp(),
  });

  return negocioId;
}

// ------------------------------------------------------------
// 3) La interfaz que la landing ya espera — no cambia nada más
// ------------------------------------------------------------

window.KARTTA_AUTH = {
  async signup(email, pass, nombreNegocio) {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (nombreNegocio) {
      await updateProfile(cred.user, { displayName: nombreNegocio });
    }
    await crearNegocioParaNuevoUsuario(cred.user, nombreNegocio);
    return cred;
  },

  async login(email, pass) {
    return signInWithEmailAndPassword(auth, email, pass);
  },

  async google() {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    // Si es la primera vez que este usuario entra, también necesita negocio.
    const yaExiste = await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    ).then(({ getDoc, doc: d }) => getDoc(d(db, "usuarios", cred.user.uid)));
    if (!yaExiste.exists()) {
      await crearNegocioParaNuevoUsuario(cred.user, cred.user.displayName || "Mi negocio");
    }
    return cred;
  },

  async logout() {
    return signOut(auth);
  },

  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },
};

console.log("[KARTTA] Firebase conectado. window.KARTTA_AUTH está activo.");
