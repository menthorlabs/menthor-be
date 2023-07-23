const mysql = require("mysql2/promise");
const CONNECTION = mysql.createConnection(process.env.DATABASE_URL);

const webhookSampleCreated = {
  data: {
    birthday: "",
    created_at: 1654012591514,
    email_addresses: [
      {
        email_address: "example@example.org",
        id: "idn_29w83yL7CwVlJXylYLxcslromF1",
        linked_to: [],
        object: "email_address",
        verification: {
          status: "verified",
          strategy: "ticket",
        },
      },
    ],
    external_accounts: [],
    external_id: "567772",
    first_name: "Example",
    gender: "",
    id: "user_29w83sxmDNGwOuEthce5gg56FcC",
    image_url: "https://img.clerk.com/xxxxxx",
    last_name: "Example",
    last_sign_in_at: 1654012591514,
    object: "user",
    password_enabled: true,
    phone_numbers: [],
    primary_email_address_id: "idn_29w83yL7CwVlJXylYLxcslromF1",
    primary_phone_number_id: null,
    primary_web3_wallet_id: null,
    private_metadata: {},
    profile_image_url: "https://www.gravatar.com/avatar?d=mp",
    public_metadata: {},
    two_factor_enabled: false,
    unsafe_metadata: {},
    updated_at: 1654012591835,
    username: null,
    web3_wallets: [],
  },
  object: "event",
  type: "user.created",
};
const webhookSampleUpdated = {
  data: {
    birthday: "",
    created_at: 1654012591514,
    email_addresses: [
      {
        email_address: "example@example.org",
        id: "idn_29w83yL7CwVlJXylYLxcslromF1",
        linked_to: [],
        object: "email_address",
        verification: {
          status: "verified",
          strategy: "admin",
        },
      },
    ],
    external_accounts: [],
    external_id: null,
    first_name: "Example",
    gender: "",
    id: "user_29w83sxmDNGwOuEthce5gg56FcC",
    image_url: "https://img.clerk.com/xxxxxx",
    last_name: null,
    last_sign_in_at: null,
    object: "user",
    password_enabled: true,
    phone_numbers: [],
    primary_email_address_id: "idn_29w83yL7CwVlJXylYLxcslromF1",
    primary_phone_number_id: null,
    primary_web3_wallet_id: null,
    private_metadata: {},
    profile_image_url: "https://www.gravatar.com/avatar?d=mp",
    public_metadata: {},
    two_factor_enabled: false,
    unsafe_metadata: {},
    updated_at: 1654012824306,
    username: null,
    web3_wallets: [],
  },
  object: "event",
  type: "user.updated",
};
const webhookSampleDeleted = {
  data: {
    deleted: true,
    id: "user_29wBMCtzATuFJut8jO2VNTVekS4",
    object: "user",
  },
  object: "event",
  type: "user.deleted",
};

const connectionResolver = async () => {
  if (CONNECTION && CONNECTION.state !== "disconnected") {
    return CONNECTION;
  } else {
    CONNECTION = mysql.createConnection(connectionString);
    CONNECTION.query = util.promisify(CONNECTION.query);

    try {
      await CONNECTION.connect();
      return CONNECTION;
    } catch (err) {
      console.error("Database connection failed: ", err.stack);
      throw err;
    }
  }
};

const clerkToDb = (clerkUser) => {
  return {
    Id: clerkUser.id,
    Username: clerkUser.username,
    Email: clerkUser.email_addresses[0].email_address,
    Name: clerkUser.first_name + " " + clerkUser.last_name ?? "",
    ImageUrl: clerkUser.image_url,
    Tags: JSON.stringify(clerkUser.private_metadata.tags),
    Ranks: JSON.stringify(clerkUser.private_metadata.ranks),
    Badges: JSON.stringify(clerkUser.private_metadata.badges),
  };
};

// Clerks webhook for create, update and delete user
module.exports.webhook = async (event, context) => {
  //   if request origin is not from clerk, return error
  if (event.headers["x-clerk-webhook-secret"] !== process.env.CLERK_SECRET) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
    };
  }

  const body = JSON.parse(event.body);

  if (body.type === "user.created") {
    const connection = await connectionResolver();

    try {
      const user = clerkToDb(body.data);
      const [rows] = await connection.query("INSERT INTO User SET ?", user);
      return {
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else if (body.type === "user.updated") {
    const connection = await connectionResolver();

    try {
      const user = clerkToDb(body.data);

      const fieldsToUpdate = {};
      Object.keys(user).forEach((key) => {
        if (!fieldsNotAllowed.includes(key)) {
          fieldsToUpdate[key] = body[key];
        }
      });

      const updateQuery = `UPDATE User SET ${Object.keys(fieldsToUpdate)
        .map((key) => `${key} = ?`)
        .join(", ")} WHERE Id = ?`;

      const updateValues = Object.values(fieldsToUpdate);
      updateValues.push(user.Id);

      connection.query(updateQuery, updateValues);
      return {
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else if (body.type === "user.deleted") {
    const connection = await connectionResolver();

    try {
      const [rows] = await connection.query("DELETE FROM User WHERE Id = ?", [
        body.data.id,
      ]);
      return {
        statusCode: 200,
        body: JSON.stringify(rows),
      };
    } catch (err) {
      console.error(err);
      return {
        statusCode: 500,
        body: JSON.stringify(err),
      };
    }
  } else {
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  }
};

module.exports.get = async (event, context) => {
  const id = event.pathParameters.id;

  const connection = await connectionResolver();
  try {
    const [rows] = await connection.query(
      "SELECT ImageUrl, Name, Tags, Ranks, Badges FROM User WHERE Id = ? or Username = ?",
      [id, id]
    );
    return {
      statusCode: 200,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err),
    };
  }
};
