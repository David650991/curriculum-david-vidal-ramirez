
/**
 * Registro de eventos del portafolio.
 * Autor: David Vidal Ramírez
 *
 * Etapa inicial: identifica acciones sin almacenar
 * información ni realizar solicitudes de red.
 */

'use strict';

const EVENT_NAME = 'portfolio:analytics';

function identifyAction(link) {
    const href = link.getAttribute('href') || '';

    // Botón existente de descarga del currículum.
    if (
        link.hasAttribute('download') &&
        href.toLowerCase().split(/[?#]/)[0].endsWith('.pdf')
    ) {
        return 'cv_download_click';
    }

    // Enlaces para abrir una aplicación de correo.
    if (href.toLowerCase().startsWith('mailto:')) {
        return 'email_click';
    }

    // Enlaces para iniciar llamadas telefónicas.
    if (href.toLowerCase().startsWith('tel:')) {
        return 'phone_click';
    }

    // Enlaces de WhatsApp.
    try {
        const url = new URL(href, window.location.href);

        if (url.hostname.toLowerCase() === 'wa.me') {
            return 'whatsapp_click';
        }

        // Clics en enlaces de navegación interna.
        if (
            link.hasAttribute('data-page-link') &&
            url.origin === window.location.origin
        ) {
            return 'navigation_click';
        }
    } catch {
        return null;
    }

    // Enlaces a demostraciones y repositorios de proyectos.
    if (link.closest('.project-card .project-links')) {
        return 'project_link_click';
    }

    return null;
}

export function initVisitorAnalytics() {
    const panel = document.querySelector('[data-visitor-analytics]');

    if (!panel) return;

    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;

        const link = event.target.closest('a[href]');
        if (!link) return;

        const action = identifyAction(link);
        if (!action) return;

        const section = link.closest('section')?.id || 'global';

        window.dispatchEvent(new CustomEvent(EVENT_NAME, {
            detail: {
                action,
                section
            }
        }));
    }, { capture: true });
}
