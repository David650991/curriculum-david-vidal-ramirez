
/**
 * Diagnóstico seguro de Firebase.
 * Autor: David Vidal Ramírez
 *
 * Autenticación anónima y prueba de lectura.
 * No registra visitas ni modifica la base de datos.
 */

'use strict';

import {
    initializeApp
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';

import {
    getAuth,
    signInAnonymously
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';

import {
    getDatabase,
    get,
    ref
} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-database.js';

import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);

export async function diagnosticarFirebase() {
    try {
        const auth = getAuth(app);
        const credential = await signInAnonymously(auth);

        if (!credential.user.isAnonymous) {
            return {
                autenticacion: 'inesperada',
                lectura: 'no comprobada'
            };
        }

        try {
            const database = getDatabase(app);

            await get(ref(database, 'metrics'));

            return {
                autenticacion: 'correcta',
                lectura: 'permitida inesperadamente',
                advertencia: 'Revisar reglas de seguridad'
            };

        } catch (error) {
            const codigo = String(error?.code ?? 'sin-codigo');
            const mensaje = String(error?.message ?? error);

            const permisoDenegado =
                /permission[_ -]denied/i.test(codigo) ||
                /permission[_ -]denied/i.test(mensaje) ||
                /doesn't have permission/i.test(mensaje);

            return {
                autenticacion: 'correcta',
                lectura: permisoDenegado
                    ? 'bloqueada correctamente'
                    : 'error distinto al bloqueo esperado',
                codigo,
                detalle: mensaje
            };
        }
    } catch (error) {
        return {
            autenticacion: 'fallida',
            codigo: String(error.code || 'sin-codigo')
        };
    }
}
