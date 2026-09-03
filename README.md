# Orange Energy Board — Guía de seguridad y administración

Proyecto de tablero de motivación para alumnos de idiomas. Front estático (Netlify) + Firebase Realtime Database + Firebase Authentication.

Este documento explica **cómo está protegido el proyecto**, **las buenas prácticas de seguridad que se aplicaron**, y **cómo dar de alta a un administrador** en Firebase. Léelo completo antes de tocar el código.

---

## 1. Modelo de seguridad en una sola página

| Rol | Cómo entra | Dónde se guarda su credencial |
|---|---|---|
| **Alumno** | Nombre + PIN de 4 caracteres | **En ningún lado.** Su clave en la BD es un hash SHA-256 de `nombre:pin`; el PIN nunca se almacena |
| **Admin** | Email + contraseña (Firebase Auth) | En **Firebase Authentication** (servidores de Firebase, no en el código) |
| **Autorización de admin** | Lista `/admins` en la base de datos | Un nodo con los UID de las cuentas autorizadas |

Reglas clave de la base de datos (versión publicada):

```
/users            → lectura pública (nombres + progreso, sin PINs)
/users/<clave>    → escritura: solo admin, o si el nodo NO existe todavía (registro)
/admins           → leer: cualquier usuario autenticado (los UID no son secretos); escribir: solo quien ya es admin
```

---

## 2. Buenas prácticas de seguridad aplicadas aquí

Estas son las reglas de oro que este proyecto ya cumple. **Respétalas al modificarlo.**

### 2.1 Nunca guardes secretos en el código del cliente
La `apiKey` de Firebase **sí puede** estar en el cliente (es pública por diseño, identifica tu app). Pero **nunca** pongas en el código:
- Contraseñas del admin (antes estaba `Iflidiomas`/`2026` hardcodeada — se eliminó).
- Las "Service Account private keys" de Firebase (son las llaves maestras del servidor; solo van en un backend).

### 2.2 No guardes contraseñas/PIN en texto plano ni como parte de claves
Antes, la clave de cada alumno era `nombre+pin` (ej: `davidsalas1904`), lo que **exponía el PIN** a cualquiera con acceso a la BD. Ahora la clave es un hash SHA-256: no se puede saber el PIN desde la base de datos, y solo quien lo conoce puede calcular la "dirección" de su casilla.

### 2.3 Las reglas de la base de datos son la seguridad real
Las reglas se evalúan en los **servidores** de Firebase en cada lectura/escritura. Aunque alguien conozca la `apiKey`, si las reglas no lo permiten, recibe "permisos denegados". Cualquier cambio que hagas en el código debe ir acompañado de las reglas adecuadas.

### 2.4 Valida las entradas (en el código y en las reglas)
- PIN: exactamente 4 caracteres y sin espacios (se permiten letras).
- Nombre: con límite de longitud y recortado.
- Modalidad: solo `in-person`, `online` o `kids`.
- En las reglas, la validación `.validate` refuerza lo mismo del lado del servidor.

### 2.5 Escrituras con mínimo alcance
Nunca se reenvía toda la colección. Cada operación escribe **solo el nodo afectado** del alumno (`update` / `remove` sobre `users/<clave>`), evitando sobrescrituras accidentales o pérdida de datos por carreras.

### 2.6 Dependencias externas con integridad (SRI)
El script de confetti carga con `integrity` para que, si el CDN se ve comprometido, el navegador rechace el código alterado.

### 2.7 Evita acceder a partes internas de las librerías
El hack anterior forzaba Long-Polling tocando `db._repo.persistentConnection_` (internals privados). Se reemplazó por la función oficial `forceLongPolling(db)`.

---

## 3. Cómo agregar un administrador (paso a paso)

Un admin necesita **dos cosas**: una cuenta en Firebase Authentication **y** su UID en la lista `/admins` de la base de datos. Sin cualquiera de las dos, no entra al panel.

### Paso A — Crear la cuenta en Firebase Authentication

1. Consola de Firebase → tu proyecto → **Authentication** → **Users**.
2. Pulsa **Add user**.
3. Email: el correo que usará (ej: `admin@ejemplo.com`).
4. Password: una contraseña segura (al menos 8 caracteres; idealmente no solo 4 dígitos).
5. **Add user**.
6. Copia el **UID** de la fila recién creada (un código largo, ej: `aXk2...`). Lo necesitas para el Paso B.

### Paso B — Autorizar el UID en la base de datos

1. Consola → **Realtime Database** → pestaña **Data**.
2. Si no existe, crea el nodo raíz `admins` (botón **+**).
3. Dentro de `admins`, añade un hijo con la clave = **UID** del usuario y valor = `true`.

```
admins
  ├── 0c2lfong6NXAAsyR1HKdSMJ8pFu2 : true
  └── <UID-del-nuevo-admin>        : true
```

4. Pulsa **Add** para guardar.

> La pestaña **Data** de la consola tiene acceso privilegiado y puede escribir aunque las reglas lo prohíban. Es la única vía para "bautizar" al primer admin.

### Paso C — Probar

Entra a la app → **Admin Mode** → escribe el **email** y la **contraseña** del usuario recién creado → **Login**. Debe abrir el panel con la lista de alumnos.

### Para quitar un admin
Borra su UID del nodo `admins` (y, si quieres, su cuenta en Authentication → Users).

---

## 4. Cómo funcionan las reglas de la base de datos

Las reglas viven en `firebase.json` (o se editan en la consola → Realtime Database → **Rules**). Se activan con el botón **Publish**.

```json
{
  "rules": {
    "admins": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && root.child('admins/' + auth.uid).exists()"
      }
    },
    "users": {
      ".read": true,
      "$key": {
        ".write": "(!data.exists()) || (auth != null && root.child('admins/' + auth.uid).exists())",
        ".validate": "newData.val() === null || (newData.hasChild('name') && newData.hasChild('modality') && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 100 && (newData.child('modality').val() === 'in-person' || newData.child('modality').val() === 'online' || newData.child('modality').val() === 'kids'))"
      }
    }
  }
}
```

Traducción:
- **`admins` (padre)** → `.read: auth != null`: cualquier usuario autenticado puede leer la lista de admins (los UID no son secretos; saberlos no da acceso). Escritura: solo quien **ya es admin**.
- **`admins/$uid`** → `.write`: solo si el UID autenticado ya está en `/admins` (no se puede auto-añadir).
- **`users` (padre)** → `.read: true`: la lista es pública (ver limitaciones abajo).
- **`users/$key`** → `.write`: paréntesis explícitos: se puede **crear** un nodo que no existe (`!data.exists()`, el registro), o **modificar** uno existente solo siendo admin. Un alumno **no puede** modificarse su propio progreso.
- **`.validate`** → solo se guardan datos con la forma correcta (nombre texto, modalidad válida, campos requeridos).

---



## 5. Checklist para futuras modificaciones

Antes de subir cualquier cambio, verifica:

- [ ] ¿Las credenciales del admin siguen **fuera** del código?
- [ ] ¿Las claves de los alumnos siguen siendo hashes (no `nombre+pin`)?
- [ ] ¿Las reglas de la BD permiten **solo** lo necesario (mínimo privilegio)?
- [ ] ¿Se valida la entrada en el código **y** en las reglas?
- [ ] ¿Las escrituras apuntan al nodo específico, sin reenviar toda la colección?
- [ ] ¿No hay dependencias nuevas sin `integrity` (SRI)?
- [ ] ¿No se accede a internals de librerías?
- [ ] ¿Probaste en el **Simulator** de reglas la lectura de `users/<clave>` sin sesión?

---

