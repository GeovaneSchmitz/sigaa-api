import { SigaaCookiesController } from '@session/sigaa-cookies-controller';

test('if Sigaa cookie controller save cookies', () => {
  const cookieController = new SigaaCookiesController();

  cookieController.storeCookies('example.com', [
    'ABC=123; Path=/',
    'A=12; Path=/'
  ]);
  expect(cookieController.getCookieHeader('example.com', '/teste')).toBe(
    'A=12; ABC=123'
  );
});

test('if Sigaa cookie controller clears all token', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', ['ABC=123; Path=/']);
  expect(cookieController.getCookieHeader('example.com', '/teste')).toBe(
    'ABC=123'
  );
  cookieController.clearCookies();
  expect(cookieController.getCookieHeader('example.com', '/teste')).toBeNull();
});

test('if Sigaa cookie controller reject cookies with invalid domain', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', [
    'ABC=123; Path=/; Domain=anotherexample.com'
  ]);
  expect(cookieController.getCookieHeader('example.com', '/')).toBeNull();
});

test('if Sigaa cookie controller ignore cookie with different paths', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', [
    'ABC=123; Path=/ABC',
    'AT=12; Path=/'
  ]);
  expect(cookieController.getCookieHeader('example.com', '/')).toBe('AT=12');
  expect(cookieController.getCookieHeader('example.com', '/ABC')).toBe(
    'AT=12; ABC=123'
  );
});

test('if Sigaa cookie controller filters cookie per domain', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', ['example=123']);
  cookieController.storeCookies('example.com', [
    'com=true; Path=/; Domain=com'
  ]);
  cookieController.storeCookies('anotherexample.com', ['another=123']);

  expect(cookieController.getCookieHeader('example.com', '/')).toBe(
    'com=true; example=123'
  );
  expect(cookieController.getCookieHeader('anotherexample.com', '/ABC')).toBe(
    'another=123; com=true'
  );
});

test('if cookie Expires flag works', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', [
    `date=true; Expires=${new Date(Date.now() - 10000).toString()}`,
    `dateanother=true; Expires=${new Date(Date.now() + 10000).toString()}`
  ]);

  expect(cookieController.getCookieHeader('example.com', '/')).toBe(
    'dateanother=true'
  );
});

test('if cookie Max-Age flag works', () => {
  const cookieController = new SigaaCookiesController();
  cookieController.storeCookies('example.com', [
    'date=true; Max-Age=-1000',
    'anotherdate=true; Max-Age=1000',
    `anotherdatewithexpires=true; Max-Age=1000; Expires=${new Date(
      Date.now() - 10000
    )}`
  ]);

  expect(cookieController.getCookieHeader('example.com', '/')).toBe(
    'anotherdatewithexpires=true; anotherdate=true'
  );
});
