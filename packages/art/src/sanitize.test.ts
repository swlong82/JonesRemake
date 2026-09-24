import { describe, expect, it } from 'vitest';
import { checkSvg, USER_LIMITS } from './sanitize.js';

const ok = (body = '<rect width="10" height="10" fill="#fff"/>') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">${body}</svg>`;

describe('checkSvg (ART_SPEC 17.6)', () => {
  it('passes clean art and reports its viewBox', () => {
    const r = checkSvg(
      ok(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>' +
          '<path d="M0 0L10 10" fill="url(#g)" style="stroke:#000"/><use href="#g"/>',
      ),
    );
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.viewBox).toEqual({ width: 64, height: 96 });
  });

  it.each([
    ['script element', ok('<script>alert(1)</script>'), 'not on the allowlist'],
    ['foreignObject', ok('<foreignObject><div/></foreignObject>'), 'not on the allowlist'],
    ['event handler', ok('<rect onclick="x()" width="1" height="1"/>'), 'event handlers'],
    [
      'onload on root',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" onload="x()"/>',
      'event handlers',
    ],
    ['external href', ok('<use href="https://example.test/a.svg#x"/>'), 'same-file'],
    [
      'external xlink',
      ok('<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="a.svg#x"/>'),
      'same-file',
    ],
    ['javascript url', ok('<rect fill="javascript:x" width="1" height="1"/>'), 'script and data'],
    [
      'external url()',
      ok('<rect fill="url(https://example.test/p)" width="1" height="1"/>'),
      'url()',
    ],
    [
      'data url in style',
      ok('<rect style="fill:url(data:image/png;base64,AA)" width="1" height="1"/>'),
      'url()',
    ],
    ['style @import', ok('<style>@import "https://example.test/x.css";</style>'), '@import'],
    ['css expression', ok('<style>rect{width:expression(alert(1))}</style>'), 'expressions'],
    ['doctype', `<!DOCTYPE svg [<!ENTITY a "b">]>${ok()}`, 'DOCTYPE'],
    ['unknown attribute', ok('<rect formaction="x" width="1" height="1"/>'), 'allowlist'],
    ['namespaced element', ok('<x:thing xmlns:x="urn:x"/>'), 'allowlist'],
    ['image element', ok('<image href="#a"/>'), 'allowlist'],
    ['not svg', '<html xmlns="http://www.w3.org/1999/xhtml"/>', 'not <svg>'],
    ['broken xml', '<svg><rect></svg>', 'well-formed'],
    ['no viewBox', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'viewBox'],
    ['bad viewBox', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 a b"/>', 'viewBox'],
  ])('rejects %s', (_name, svg, message) => {
    const r = checkSvg(svg);
    expect(r.ok).toBe(false);
    expect(r.issues.join('\n')).toContain(message);
  });

  it('enforces byte and element limits', () => {
    const big = ok(`<desc>${'x'.repeat(70 * 1024)}</desc>`);
    expect(checkSvg(big).issues.join()).toContain('bytes');
    expect(checkSvg(big, USER_LIMITS).ok).toBe(true);
    const many = ok('<g/>'.repeat(20));
    expect(checkSvg(many, { maxBytes: 1e6, maxElements: 10 }).issues.join()).toContain('elements');
  });

  it('reports a parser that throws as malformed', () => {
    const r = checkSvg(ok(), undefined, () => {
      throw new Error('boom');
    });
    expect(r).toEqual({ ok: false, issues: ['not well-formed XML'] });
  });
});
