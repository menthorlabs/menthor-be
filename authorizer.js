"use strict";

const verify = require("jsonwebtoken").verify;

module.exports.handler = async (event) => {
  if (process.env.NODE_ENV === "development") {
    return {
      principalId: "email@email.com",
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

  const Authorization =
    event.headers?.Authorization ||
    event.headers?.authorization ||
    event.authorizationToken;
  const splitPem = process.env.CLERK_JWT_VERIFICATION_KEY?.match(/.{1,64}/g);
  const publicKey =
    "-----BEGIN PUBLIC KEY-----\n" +
    splitPem?.join("\n") +
    "\n-----END PUBLIC KEY-----";
  if (!Authorization) {
    throw Error("Not Signed In");
  }
  try {
    const jwt = Authorization.split(" ")[1];
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
    console.error(error);
    throw Error("Unauthorized");
  }
};
