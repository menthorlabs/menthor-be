const axios = require("axios");

const API_ENDPOINT = "https://discord.com/api/v10";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.BOT_SECRET;

const AvailableRoles = [
  {
    id: "1091430078853955656",
    name: "@everyone",
    description: null,
    permissions: "111022861307457",
    position: 0,
    color: 0,
    hoist: false,
    managed: false,
    mentionable: false,
    icon: null,
    unicode_emoji: null,
    flags: 0,
  },
  {
    id: "1121857528058364084",
    name: "novo cargo",
    description: null,
    permissions: "0",
    position: 2,
    color: 0,
    hoist: false,
    managed: false,
    mentionable: false,
    icon: null,
    unicode_emoji: null,
    flags: 0,
  },
  {
    id: "1129825920375603283",
    name: "Menthor",
    description: null,
    permissions: "1",
    position: 1,
    color: 0,
    hoist: false,
    managed: true,
    mentionable: false,
    icon: null,
    unicode_emoji: null,
    tags: {
      bot_id: "1125151922958106734",
    },
    flags: 0,
  },
];

const getToken = async () => {
  try {
    const url = `${API_ENDPOINT}/oauth2/token`;
    const response = await axios.post(
      url,
      `grant_type=client_credentials&scope=guilds%20identify%20email%20connections`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${CLIENT_ID}:${CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getDiscordUser = async () => {
  const token = await getToken();

  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error getting token" }),
    };
  }

  try {
    const url = `${API_ENDPOINT}/users/@me`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

module.exports.requestRole = async (event, context) => {
  // get the role id and check if is valid
  const roleId = event.pathParameters.roleId;
  if (!AvailableRoles.find((role) => role.id === roleId)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid role" }),
    };
  }

  // call addrole and return the result
  return await module.exports.addRole(event, context);
};

module.exports.leave = async (event, context) => {
  // get the role id and check if is valid
  const roleId = event.body.roleId;
  if (!AvailableRoles.find((role) => role.id === roleId)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid role" }),
    };
  }

  // call addrole and return the result
  return await module.exports.removeRole(event, context);
};

module.exports.addRole = async (event, context) => {
  const user = await getDiscordUser();
  const config = {
    headers: {
      Authorization: `Bot ${process.env.BOT_TOKEN}`,
    },
  };

  // Extract the guild ID from the environment context
  const guildId = process.env.GUILD_ID;

  // Extract the role ID from the path of the request
  const roleId = event.pathParameters.roleId;

  // Generate the URL for the guild member role endpoint
  const url = `${API_ENDPOINT}/guilds/${guildId}/members/${user.id}/roles/${roleId}`;

  try {
    // Add the role to the guild member
    await axios.put(url, {}, config);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Role added successfully" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error adding role" }),
    };
  }
};

module.exports.removeRole = async (event, context) => {
  const user = await getDiscordUser();
  const config = {
    headers: {
      Authorization: `Bot ${process.env.BOT_TOKEN}`,
    },
  };

  // Extract the guild ID from the environment context
  const guildId = process.env.GUILD_ID;

  // Extract the role ID from the path of the request
  const roleId = event.pathParameters.roleId;

  // Generate the URL for the guild member role endpoint
  const url = `${API_ENDPOINT}/guilds/${guildId}/members/${user.id}/roles/${roleId}`;

  try {
    // Remove the role from the guild member
    await axios.delete(url, config);

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
