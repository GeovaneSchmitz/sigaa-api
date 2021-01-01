import { SigaaTokens } from "@session/sigaa-tokens";

test('if Sigaa token save token', () => {
  const sigaaToken = new SigaaTokens();
  const domain = 'exemple.com';
  const token = 'token=1';
  sigaaToken.setToken(domain, token);
  expect(sigaaToken.getTokenByDomain(domain)).toBe(token);
});

test('if Sigaa token clears all token', () => {
  const sigaaToken = new SigaaTokens();
  const domain = 'exemple.com';
  const token = 'token=1';
  sigaaToken.setToken(domain, token);
  sigaaToken.clearTokens();
  expect(sigaaToken.tokens).toStrictEqual({});
  expect(sigaaToken.getTokenByDomain(domain)).toBeNull();
});
