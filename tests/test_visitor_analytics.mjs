import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = {
    location: {
        href: 'https://david650991.github.io/curriculum-david-vidal-ramirez/',
        origin: 'https://david650991.github.io'
    }
};

const { identifyAction } = await import(
    '../src/js/modules/visitor-analytics.js'
);

function link({ href, download = false, page = false, project = false }) {
    return {
        getAttribute(name) {
            return name === 'href' ? href : null;
        },
        hasAttribute(name) {
            return (
                (name === 'download' && download) ||
                (name === 'data-page-link' && page)
            );
        },
        closest(selector) {
            return selector === '.project-card .project-links' && project
                ? {}
                : null;
        }
    };
}

test('clasifica las seis interacciones públicas relevantes', () => {
    const cases = [
        [
            link({ href: '/assets/cv.pdf', download: true }),
            'cv_download_click'
        ],
        [link({ href: 'mailto:persona@example.com' }), 'email_click'],
        [link({ href: 'tel:+522871234567' }), 'phone_click'],
        [link({ href: 'https://wa.me/522871234567' }), 'whatsapp_click'],
        [
            link({
                href: '/proyectos/?utm_source=whatsapp',
                page: true
            }),
            'navigation_click'
        ],
        [
            link({ href: 'https://github.com/example', project: true }),
            'project_link_click'
        ]
    ];

    for (const [element, expected] of cases) {
        assert.equal(identifyAction(element), expected);
    }
});

test('un enlace ajeno a las categorías no genera estadísticas', () => {
    assert.equal(
        identifyAction(link({ href: 'https://example.com' })),
        null
    );
});

test('la instrumentación no bloquea enlaces ni descargas', async () => {
    const source = await readFile(
        new URL('../src/js/modules/visitor-analytics.js', import.meta.url),
        'utf8'
    );

    assert.doesNotMatch(source, /preventDefault\s*\(/);
    assert.doesNotMatch(source, /stopPropagation\s*\(/);
});
