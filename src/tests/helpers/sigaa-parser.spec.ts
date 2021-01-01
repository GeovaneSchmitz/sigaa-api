import { SigaaParser } from '@helpers/sigaa-parser';

test('if sigaa parser remove script tags', () => {
  const sigaaParser = new SigaaParser();
  const html = `some text <script>alert('error')</script> more text`;
  expect(sigaaParser.removeTagsHtml(html)).toBe(`some text more text`);
});

test('if sigaa parser remove style tags', () => {
  const sigaaParser = new SigaaParser();
  const html = `some text &lt;script&gt;alert('alert');&lt;/script&gt;
  <style>
  .style{
    .error {
      background: #red
    }
  }
  </style>
  `;
  expect(sigaaParser.removeTagsHtml(html)).toBe(
    `some text <script>alert('alert');</script>`
  );
});

test('if Sigaa parser keeping only emphasis tags', () => {
  const sigaaParser = new SigaaParser();
  const html = `some text<b onmouseover="alert(123)">bold</b><style>b{font-weight:700;}</style><script>alert('alert')</script>`;
  expect(sigaaParser.removeTagsHtmlKeepingEmphasis(html)).toBe(
    'some text<b>bold</b>'
  );
});

test('if sigaa parser date', () => {
  const sigaaParser = new SigaaParser();
  expect(sigaaParser.parseDates('01/01/01', 1)).toStrictEqual([
    new Date('2001-01-01T00:00')
  ]);

  expect(sigaaParser.parseDates('01/01', 1, 2010)).toStrictEqual([
    new Date('2010-01-01T00:00')
  ]);

  expect(sigaaParser.parseDates('01/01 02:03', 1, 2010)).toStrictEqual([
    new Date('2010-01-01T02:03')
  ]);

  expect(sigaaParser.parseDates('01/01/01', 1, 2010)).toStrictEqual([
    new Date('2001-01-01T00:00')
  ]);
  const currentYear = new Date().getFullYear();
  expect(sigaaParser.parseDates('01/01 às 20:10', 1)).toStrictEqual([
    new Date(currentYear + '-01-01T20:10')
  ]);

  expect(sigaaParser.parseDates('01/02 às 20:10:30', 1)).toStrictEqual([
    new Date(currentYear + '-02-01T20:10:30')
  ]);

  expect(sigaaParser.parseDates('01/02 às 20h10', 1)).toStrictEqual([
    new Date(currentYear + '-02-01T20:10:00')
  ]);

  expect(sigaaParser.parseDates('01/02 às 20h10 e 20:30', 2)).toStrictEqual([
    new Date(currentYear + '-02-01T20:10:00'),
    new Date(currentYear + '-02-01T20:30:00')
  ]);

  expect(sigaaParser.parseDates('01/02/2001 01/01/2001', 2)).toStrictEqual([
    new Date('2001-02-01T00:00:00'),
    new Date('2001-01-01T00:00:00')
  ]);
});
