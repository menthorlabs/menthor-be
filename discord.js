const axios = require("axios");
const querystring = require("querystring");

const API_ENDPOINT = "https://discord.com/api/v10";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const AvailableRoles = {
  Student: "1j24po1u2h412n5iopu12h5oiu",
};

module.exports.requestRole = async (event, context) => {
  // get the role id and check if is valid
  const roleId = event.body.roleId;
  if (!AvailableRoles[roleId]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid role" }),
    };
  }

  // call addrole and return the result
  return await module.exports.addRole(event, context);
};

module.exports.getAllRoles = async (event, context) => {
  const data = querystring.stringify({
    grant_type: "client_credentials",
    scope: "identify connections",
  });

  const config = {
    method: "post",
    url: `${API_ENDPOINT}/oauth2/token`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: data,
    auth: {
      username: CLIENT_ID,
      password: CLIENT_SECRET,
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

module.exports.leave = async (event, context) => {
  // get the role id and check if is valid
  const roleId = event.body.roleId;
  if (!AvailableRoles[roleId]) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid role" }),
    };
  }

  // call addrole and return the result
  return await module.exports.removeRole(event, context);
};

module.exports.addRole = async (event, context) => {
  // Extract the guild ID from the environment context
  const guildId = process.env.GUILD_ID;

  // Extract the user ID from the body of the payload
  const userId = event.body.userId;

  // Extract the role ID from the path of the request
  const roleId = event.pathParameters.roleId;

  // Generate the URL for the guild member role endpoint
  const url = `https://discord.com/api/v9/guilds/${guildId}/members/${userId}/roles/${roleId}`;

  try {
    // Add the role to the guild member
    await axios.put(url);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Role added successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error adding role" }),
    };
  }
};

module.exports.removeRole = async (event, context) => {
  // Extract the guild ID from the environment context
  const guildId = process.env.GUILD_ID;

  // Extract the user ID from the body of the payload
  const userId = event.body.userId;

  // Extract the role ID from the path of the request
  const roleId = event.pathParameters.roleId;

  // Generate the URL for the guild member role endpoint
  const url = `https://discord.com/api/v9/guilds/${guildId}/members/${userId}/roles/${roleId}`;

  try {
    // Remove the role from the guild member
    await axios.delete(url);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Role removed successfully" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error removing role" }),
    };
  }
};
