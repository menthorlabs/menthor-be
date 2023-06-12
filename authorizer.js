"use strict";

const verify = require("jsonwebtoken").verify;

function extractSessionIdFromCookie(Cookie) {
  if (!Cookie) {
    return null;
  }
  const regexPattern = /(?<=__session=)[^;]+/;
  const match = Cookie.match(regexPattern);

  if (match) {
    const result = match[0];
    return result;
  }
  return null;
}

module.exports.handler = async (event) => {
  const Cookie = event.headers.Cookie || event.headers.Cookie;
  const sessionId = extractSessionIdFromCookie(Cookie);
  const Authorization =
    event.headers.Authorization || event.headers.authorization;
  const splitPem = process.env.CLERK_JWT_VERIFICATION_KEY?.match(/.{1,64}/g);
  const publicKey =
    "-----BEGIN PUBLIC KEY-----\n" +
    splitPem?.join("\n") +
    "\n-----END PUBLIC KEY-----";

  if (!sessionId && !Authorization) {
    throw Error("Not Signed In");
  }
  try {
    const jwt = sessionId || Authorization.split(" ")[1];
    if (jwt === "MENTHOR-DEV" && process.env.NODE_ENV === "development") {
      return {
        principalId: "beb6c8dd-fd94-11ed-95f4-ce3d95a8e965",
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Allow",
              Resource: event.methodArn,
            },
          ],
        },
      };
    }
    const decoded = verify(jwt, publicKey);
    return {
      principalId: decoded.email,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: event.methodArn,
          },
        ],
      },
    };
  } catch (error) {
    throw Error("Unauthorized");
  }
};
