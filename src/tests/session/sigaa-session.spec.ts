import { SigaaAccountStudent } from "@accounts/sigaa-account-student";
import { SigaaParser } from "@helpers/sigaa-parser";
import { SigaaHTTPSession } from "@session/http-session";
import { SigaaHTTP } from "@session/sigaa-http";
import { SigaaPageCache } from "@session/sigaa-page-cache";
import { SigaaSession } from "@session/sigaa-session";
import { SigaaTokens } from "@session/sigaa-tokens";
import { LoginStatus } from "src/sigaa-types";

test('if sigaa session is unauthenticated', () => {
  const sigaaSession = new SigaaSession();
  expect(sigaaSession.loginStatus).toBe(LoginStatus.Unauthenticated);
});

test('if sigaa session store the account', () => {
  const sigaaSession = new SigaaSession();
  const sigaaToken = new SigaaTokens();
  const parser = new SigaaParser();
  const pageCache = new SigaaPageCache();
  const httpSession = new SigaaHTTPSession(
    'http://localhost',
    sigaaToken,
    pageCache
  );
  const http = new SigaaHTTP(httpSession);
  const account = new SigaaAccountStudent(http, parser, sigaaSession);
  sigaaSession.account = [account];
  expect(sigaaSession.account).toStrictEqual([account]);
});
